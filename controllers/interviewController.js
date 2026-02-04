// controllers/interviewController.js
const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { v4: uuidv4 } = require('uuid');
const NotificationService = require('../services/notificationService');

// Schedule a new interview
const scheduleInterview = async (req, res) => {
  let client;
  
  try {
    const userId = req.user.user_id;
    const { 
      request_id, 
      freelancer_id, 
      interview_type = 'video',
      scheduled_date,
      duration_minutes = 60,
      location = null,
      interview_notes = null,
      invitation_message = null
    } = req.body;

    console.log(`🔍 Associate ${userId} scheduling interview with freelancer ${freelancer_id} for request ${request_id}`);

    // Validate required fields
    if (!request_id || !freelancer_id || !scheduled_date) {
      return res.status(400).json({
        success: false,
        message: 'Request ID, freelancer ID, and scheduled date are required'
      });
    }

    // Validate interview type
    if (!['video', 'phone', 'in_person'].includes(interview_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview type. Must be video, phone, or in_person'
      });
    }

    // Validate scheduled date is in the future
    const scheduledDate = new Date(scheduled_date);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date must be in the future'
      });
    }

    // Get database client
    client = await db.pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Verify the request belongs to this associate
    const requestResult = await client.query(
      `SELECT r.*, a.associate_id, a.user_id as associate_user_id
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       WHERE r.request_id = $1`,
      [request_id]
    );

    if (requestResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requestResult.rows[0];
    
    if (request.associate_user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied - this request does not belong to you'
      });
    }

    // Verify the freelancer was recommended for this request
    const recommendationResult = await client.query(
      'SELECT * FROM "Freelancer_Recommendation" WHERE request_id = $1 AND freelancer_id = $2',
      [request_id, freelancer_id]
    );

    if (recommendationResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This freelancer was not recommended for this request'
      });
    }

    // Check if there's already a scheduled interview for this request and freelancer
    const existingInterviewResult = await client.query(
      'SELECT * FROM "Interview" WHERE request_id = $1 AND freelancer_id = $2 AND status IN ($3, $4)',
      [request_id, freelancer_id, 'scheduled', 'in_progress']
    );

    if (existingInterviewResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'There is already a scheduled interview for this freelancer and request'
      });
    }

    // Generate meeting link for video interviews
    let meetingLink = null;
    if (interview_type === 'video') {
      // Use Daily.co for reliable video calls
      // Generate a unique room name
      const roomName = `cvconnect-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      meetingLink = roomName;
    }

    // Create the interview record
    const interviewResult = await client.query(
      `INSERT INTO "Interview" 
       (request_id, associate_id, freelancer_id, interview_type, scheduled_date, 
        duration_minutes, meeting_link, location, interview_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING interview_id`,
      [
        request_id, 
        request.associate_id, 
        freelancer_id, 
        interview_type,
        scheduled_date,
        duration_minutes,
        meetingLink,
        location,
        interview_notes
      ]
    );

    const interviewId = interviewResult.rows[0].interview_id;

    // Create interview invitation
    const invitationResult = await client.query(
      `INSERT INTO "Interview_Invitation" 
       (interview_id, associate_id, freelancer_id, invitation_message, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING invitation_id`,
      [
        interviewId,
        request.associate_id,
        freelancer_id,
        invitation_message,
        new Date(scheduledDate.getTime() + (24 * 60 * 60 * 1000)) // Expires in 24 hours
      ]
    );

    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'interview_scheduled',
      details: `Scheduled ${interview_type} interview with freelancer ${freelancer_id} for request ${request_id}`
    });

    // Commit transaction
    await client.query('COMMIT');

    // Get freelancer user ID for notifications
    const freelancerResult = await db.query(
      'SELECT user_id FROM "Freelancer" WHERE freelancer_id = $1',
      [freelancer_id]
    );

    if (freelancerResult.rowCount > 0) {
      const freelancer_user_id = freelancerResult.rows[0].user_id;

      try {
        // Create immediate notification for freelancer
        const notification = await NotificationService.createInterviewScheduledNotification({
          freelancer_user_id,
          associate_user_id: userId,
          interview_id: interviewId,
          interview_type,
          scheduled_date,
          job_title: request.title,
          associate_name: request.contact_person || 'Associate'
        });

        // Send notification via WebSocket if available
        if (global.io) {
          await NotificationService.sendNotification(global.io, notification);
        }

        // Create scheduled reminder notifications
        await NotificationService.createInterviewReminders(
          interviewId,
          freelancer_user_id,
          new Date(scheduled_date),
          request.title,
          request.contact_person || 'Associate'
        );

        console.log(`📱 Interview notifications created for freelancer ${freelancer_user_id}`);
      } catch (notificationError) {
        console.error('❌ Notification creation failed:', notificationError);
        // Don't fail the interview creation if notifications fail
      }
    }

    console.log(`✅ Interview ${interviewId} scheduled successfully by associate ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully',
      data: {
        interview_id: interviewId,
        meeting_link: meetingLink,
        scheduled_date: scheduled_date,
        interview_type: interview_type
      }
    });

  } catch (error) {
    console.error('❌ Schedule interview error:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to schedule interview',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Get interviews for a user (associate or freelancer)
const getInterviews = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userType = req.user.user_type;
    const { status, limit = 50, offset = 0 } = req.query;

    console.log(`🔍 Getting interviews for ${userType} ${userId}`);

    let query, params;

    if (userType === 'associate') {
      // Get associate's interviews
      if (status) {
        query = `
          SELECT 
            i.*,
            f.first_name as freelancer_first_name,
            f.last_name as freelancer_last_name,
            f.headline as freelancer_headline,
            f.profile_picture_url as freelancer_photo,
            r.title as request_title,
            r.description as request_description,
            ii.invitation_status,
            ii.invitation_message
          FROM "Interview" i
          JOIN "Associate" a ON i.associate_id = a.associate_id
          JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
          JOIN "Associate_Freelancer_Request" r ON i.request_id = r.request_id
          LEFT JOIN "Interview_Invitation" ii ON i.interview_id = ii.interview_id
          WHERE a.user_id = $1 AND i.status = $2
          ORDER BY i.scheduled_date DESC
          LIMIT $3 OFFSET $4
        `;
        params = [userId, status, limit, offset];
      } else {
        query = `
          SELECT 
            i.*,
            f.first_name as freelancer_first_name,
            f.last_name as freelancer_last_name,
            f.headline as freelancer_headline,
            f.profile_picture_url as freelancer_photo,
            r.title as request_title,
            r.description as request_description,
            ii.invitation_status,
            ii.invitation_message
          FROM "Interview" i
          JOIN "Associate" a ON i.associate_id = a.associate_id
          JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
          JOIN "Associate_Freelancer_Request" r ON i.request_id = r.request_id
          LEFT JOIN "Interview_Invitation" ii ON i.interview_id = ii.interview_id
          WHERE a.user_id = $1
          ORDER BY i.scheduled_date DESC
          LIMIT $2 OFFSET $3
        `;
        params = [userId, limit, offset];
      }
    } else if (userType === 'freelancer') {
      // Get freelancer's interviews
      if (status) {
        query = `
          SELECT 
            i.*,
            a.industry as associate_company,
            a.contact_person as associate_contact,
            r.title as request_title,
            r.description as request_description,
            ii.invitation_status,
            ii.invitation_message,
            ii.expires_at
          FROM "Interview" i
          JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
          JOIN "Associate" a ON i.associate_id = a.associate_id
          JOIN "Associate_Freelancer_Request" r ON i.request_id = r.request_id
          LEFT JOIN "Interview_Invitation" ii ON i.interview_id = ii.interview_id
          WHERE f.user_id = $1 AND i.status = $2
          ORDER BY i.scheduled_date DESC
          LIMIT $3 OFFSET $4
        `;
        params = [userId, status, limit, offset];
      } else {
        query = `
          SELECT 
            i.*,
            a.industry as associate_company,
            a.contact_person as associate_contact,
            r.title as request_title,
            r.description as request_description,
            ii.invitation_status,
            ii.invitation_message,
            ii.expires_at
          FROM "Interview" i
          JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
          JOIN "Associate" a ON i.associate_id = a.associate_id
          JOIN "Associate_Freelancer_Request" r ON i.request_id = r.request_id
          LEFT JOIN "Interview_Invitation" ii ON i.interview_id = ii.interview_id
          WHERE f.user_id = $1
          ORDER BY i.scheduled_date DESC
          LIMIT $2 OFFSET $3
        `;
        params = [userId, limit, offset];
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only associates and freelancers can view interviews.'
      });
    }

    const result = await db.query(query, params);
    const interviews = result.rows;

    // Get feedback for each interview
    const interviewsWithFeedback = await Promise.all(
      interviews.map(async (interview) => {
        const feedbackResult = await db.query(
          `SELECT * FROM "Interview_Feedback" 
           WHERE interview_id = $1 
           ORDER BY submitted_at DESC`,
          [interview.interview_id]
        );
        
        return {
          ...interview,
          feedback: feedbackResult.rows
        };
      })
    );

    return res.status(200).json({
      success: true,
      interviews: interviewsWithFeedback,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: interviewsWithFeedback.length
      }
    });

  } catch (error) {
    console.error('❌ Get interviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch interviews',
      error: error.message
    });
  }
};

// Respond to interview invitation (freelancer only)
const respondToInvitation = async (req, res) => {
  let client;
  
  try {
    const userId = req.user.user_id;
    const { interview_id, response, response_notes = null } = req.body;

    console.log(`🔍 Freelancer ${userId} responding to interview invitation ${interview_id} with response: ${response}`);

    // Validate response
    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid response. Must be accepted or declined'
      });
    }

    // Get database client
    client = await db.pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Verify the interview invitation exists and belongs to this freelancer
    const invitationResult = await client.query(
      `SELECT ii.*, f.user_id as freelancer_user_id, i.status as interview_status
       FROM "Interview_Invitation" ii
       JOIN "Freelancer" f ON ii.freelancer_id = f.freelancer_id
       JOIN "Interview" i ON ii.interview_id = i.interview_id
       WHERE ii.interview_id = $1 AND f.user_id = $2`,
      [interview_id, userId]
    );

    if (invitationResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Interview invitation not found or access denied'
      });
    }

    const invitation = invitationResult.rows[0];

    // Check if invitation has already been responded to
    if (invitation.invitation_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been responded to'
      });
    }

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This invitation has expired'
      });
    }

    // Update invitation status
    await client.query(
      `UPDATE "Interview_Invitation" 
       SET invitation_status = $1, response_notes = $2, responded_at = CURRENT_TIMESTAMP
       WHERE interview_id = $3`,
      [response, response_notes, interview_id]
    );

    // If declined, cancel the interview
    if (response === 'declined') {
      await client.query(
        `UPDATE "Interview" 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE interview_id = $1`,
        [interview_id]
      );
    }

    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'freelancer',
      activity_type: 'interview_invitation_response',
      details: `Freelancer ${response} interview invitation ${interview_id}`
    });

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Interview invitation ${interview_id} ${response} by freelancer ${userId}`);

    return res.status(200).json({
      success: true,
      message: `Interview invitation ${response} successfully`,
      data: {
        interview_id: interview_id,
        response: response,
        response_notes: response_notes
      }
    });

  } catch (error) {
    console.error('❌ Respond to invitation error:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to respond to invitation',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Submit interview feedback
const submitFeedback = async (req, res) => {
  let client;
  
  try {
    const userId = req.user.user_id;
    const userType = req.user.user_type;
    const { 
      interview_id,
      technical_skills_rating,
      communication_rating,
      cultural_fit_rating,
      overall_rating,
      strengths,
      areas_for_improvement,
      recommendation,
      detailed_feedback
    } = req.body;

    console.log(`🔍 ${userType} ${userId} submitting feedback for interview ${interview_id}`);

    // Validate required fields
    if (!interview_id || !overall_rating || !recommendation) {
      return res.status(400).json({
        success: false,
        message: 'Interview ID, overall rating, and recommendation are required'
      });
    }

    // Validate ratings (1-5)
    const ratings = [technical_skills_rating, communication_rating, cultural_fit_rating, overall_rating];
    for (const rating of ratings) {
      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          success: false,
          message: 'All ratings must be between 1 and 5'
        });
      }
    }

    // Validate recommendation
    if (!['hire', 'no_hire', 'maybe'].includes(recommendation)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recommendation. Must be hire, no_hire, or maybe'
      });
    }

    // Get database client
    client = await db.pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Verify the interview exists and user has access
    let interviewQuery;
    if (userType === 'associate') {
      interviewQuery = `
        SELECT i.*, a.user_id as associate_user_id
        FROM "Interview" i
        JOIN "Associate" a ON i.associate_id = a.associate_id
        WHERE i.interview_id = $1 AND a.user_id = $2
      `;
    } else if (userType === 'freelancer') {
      interviewQuery = `
        SELECT i.*, f.user_id as freelancer_user_id
        FROM "Interview" i
        JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
        WHERE i.interview_id = $1 AND f.user_id = $2
      `;
    } else {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only associates and freelancers can submit feedback.'
      });
    }

    const interviewResult = await client.query(interviewQuery, [interview_id, userId]);

    if (interviewResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Interview not found or access denied'
      });
    }

    const interview = interviewResult.rows[0];

    // Check if interview is completed
    if (interview.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted for completed interviews'
      });
    }

    // Check if feedback already exists from this user
    const existingFeedbackResult = await client.query(
      'SELECT * FROM "Interview_Feedback" WHERE interview_id = $1 AND evaluator_id = $2',
      [interview_id, userId]
    );

    if (existingFeedbackResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Feedback has already been submitted for this interview'
      });
    }

    // Insert feedback
    const feedbackResult = await client.query(
      `INSERT INTO "Interview_Feedback" 
       (interview_id, evaluator_id, evaluator_type, technical_skills_rating, 
        communication_rating, cultural_fit_rating, overall_rating, strengths, 
        areas_for_improvement, recommendation, detailed_feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING feedback_id`,
      [
        interview_id,
        userId,
        userType,
        technical_skills_rating || null,
        communication_rating || null,
        cultural_fit_rating || null,
        overall_rating,
        strengths || null,
        areas_for_improvement || null,
        recommendation,
        detailed_feedback || null
      ]
    );

    const feedbackId = feedbackResult.rows[0].feedback_id;

    // Log the activity
    await logActivity({
      user_id: userId,
      role: userType,
      activity_type: 'interview_feedback_submitted',
      details: `Submitted feedback for interview ${interview_id} with recommendation: ${recommendation}`
    });

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Feedback ${feedbackId} submitted successfully by ${userType} ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedback_id: feedbackId,
        interview_id: interview_id,
        recommendation: recommendation
      }
    });

  } catch (error) {
    console.error('❌ Submit feedback error:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Update interview status (for starting/ending interviews)
const updateInterviewStatus = async (req, res) => {
  let client;
  
  try {
    const userId = req.user.user_id;
    const userType = req.user.user_type;
    const { interview_id, status, notes = null } = req.body;

    console.log(`🔍 ${userType} ${userId} updating interview ${interview_id} status to ${status}`);

    // Validate status
    if (!['in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be in_progress, completed, or cancelled'
      });
    }

    // Get database client
    client = await db.pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Verify the interview exists and user has access
    let interviewQuery;
    if (userType === 'associate') {
      interviewQuery = `
        SELECT i.*, a.user_id as associate_user_id
        FROM "Interview" i
        JOIN "Associate" a ON i.associate_id = a.associate_id
        WHERE i.interview_id = $1 AND a.user_id = $2
      `;
    } else if (userType === 'freelancer') {
      interviewQuery = `
        SELECT i.*, f.user_id as freelancer_user_id
        FROM "Interview" i
        JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
        WHERE i.interview_id = $1 AND f.user_id = $2
      `;
    } else {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only associates and freelancers can update interview status.'
      });
    }

    const interviewResult = await client.query(interviewQuery, [interview_id, userId]);

    if (interviewResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Interview not found or access denied'
      });
    }

    const interview = interviewResult.rows[0];

    // Update interview status and notes
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [status];
    let paramIndex = 2;

    if (notes) {
      if (userType === 'associate') {
        updateFields.push(`associate_notes = $${paramIndex++}`);
        updateValues.push(notes);
      } else if (userType === 'freelancer') {
        updateFields.push(`freelancer_notes = $${paramIndex++}`);
        updateValues.push(notes);
      }
    }

    updateValues.push(interview_id);

    await client.query(
      `UPDATE "Interview" 
       SET ${updateFields.join(', ')}
       WHERE interview_id = $${paramIndex}`,
      updateValues
    );

    // Log the activity
    await logActivity({
      user_id: userId,
      role: userType,
      activity_type: 'interview_status_updated',
      details: `Updated interview ${interview_id} status to ${status}`
    });

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Interview ${interview_id} status updated to ${status} by ${userType} ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Interview status updated successfully',
      data: {
        interview_id: interview_id,
        status: status,
        notes: notes
      }
    });

  } catch (error) {
    console.error('❌ Update interview status error:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update interview status',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  scheduleInterview,
  getInterviews,
  respondToInvitation,
  submitFeedback,
  updateInterviewStatus
};
