// routes/search.js - FIXED VERSION for PostgreSQL JSON issue
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');

// FIXED VERSION - Handles PostgreSQL JSON aggregation properly
router.get('/freelancers', authenticateToken, requireRole(['associate', 'admin']), async (req, res) => {
  try {
    const {
      keyword,
      skills,
      min_experience,
      max_experience,
      location,
      page = 1,
      limit = 10
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build query parts
    let whereConditions = ['u.is_active = true'];
    let joins = 'JOIN "User" u ON f.user_id = u.user_id';
    const params = [];
    
    // Add search conditions one by one
    if (keyword) {
      whereConditions.push(`(
        f.first_name ILIKE $${params.length + 1} OR
        f.last_name ILIKE $${params.length + 1} OR
        f.summary ILIKE $${params.length + 1} OR
        f.headline ILIKE $${params.length + 1}
      )`);
      params.push(`%${keyword}%`);
    }
    
    if (min_experience) {
      whereConditions.push(`f.years_experience >= $${params.length + 1}`);
      params.push(parseInt(min_experience));
    }
    
    if (max_experience) {
      whereConditions.push(`f.years_experience <= $${params.length + 1}`);
      params.push(parseInt(max_experience));
    }
    
    if (location) {
      whereConditions.push(`f.address ILIKE $${params.length + 1}`);
      params.push(`%${location}%`);
    }
    
    // Handle skills with EXISTS - this avoids parameter type issues
    if (skills) {
      const skillArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
      
      if (skillArray.length > 0) {
        const skillConditions = skillArray.map(skill => {
          const paramIndex = params.length + 1;
          params.push(`%${skill}%`);
          return `
            EXISTS (
              SELECT 1 FROM "Freelancer_Skill" fs 
              JOIN "Skill" s ON fs.skill_id = s.skill_id 
              WHERE fs.freelancer_id = f.freelancer_id 
              AND s.name ILIKE $${paramIndex}
            )
          `;
        });
        
        whereConditions.push(`(${skillConditions.join(' OR ')})`);
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT f.freelancer_id) 
      FROM "Freelancer" f
      ${joins}
      ${whereClause}
    `;
    
    console.log('Count Query:', countQuery);
    console.log('Count Parameters:', params);
    
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count || '0');
    
    // FIXED: Main search query with proper JSON handling
    const searchQuery = `
      SELECT DISTINCT f.*, u.email, u.created_at
      FROM "Freelancer" f
      ${joins}
      ${whereClause}
      ORDER BY f.years_experience DESC, f.freelancer_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    // Add pagination parameters
    const finalParams = [...params, parseInt(limit), offset];
    
    console.log('Search Query:', searchQuery);
    console.log('Search Parameters:', finalParams);
    
    const searchResult = await db.query(searchQuery, finalParams);
    
    // Get skills for each freelancer separately to avoid JSON aggregation issues
    const freelancers = await Promise.all(
      searchResult.rows.map(async (freelancer) => {
        const skillsQuery = `
          SELECT s.skill_id, s.name as skill_name, fs.proficiency_level, fs.years_experience
          FROM "Freelancer_Skill" fs
          JOIN "Skill" s ON fs.skill_id = s.skill_id
          WHERE fs.freelancer_id = $1
          ORDER BY fs.proficiency_level DESC, s.name ASC
        `;
        
        const skillsResult = await db.query(skillsQuery, [freelancer.freelancer_id]);
        
        return {
          ...freelancer,
          skills: skillsResult.rows
        };
      })
    );
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      freelancers,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Search failed'
    });
  }
});

// ALTERNATIVE - Single query with COALESCE for JSON handling
router.get('/freelancers-single-query', authenticateToken, requireRole(['associate', 'admin']), async (req, res) => {
  try {
    const {
      keyword,
      skills,
      min_experience,
      max_experience,
      location,
      page = 1,
      limit = 10
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build query parts
    let whereConditions = ['u.is_active = true'];
    let joins = 'JOIN "User" u ON f.user_id = u.user_id';
    const params = [];
    
    // Add search conditions
    if (keyword) {
      whereConditions.push(`(
        f.first_name ILIKE $${params.length + 1} OR
        f.last_name ILIKE $${params.length + 1} OR
        f.summary ILIKE $${params.length + 1} OR
        f.headline ILIKE $${params.length + 1}
      )`);
      params.push(`%${keyword}%`);
    }
    
    if (min_experience) {
      whereConditions.push(`f.years_experience >= $${params.length + 1}`);
      params.push(parseInt(min_experience));
    }
    
    if (max_experience) {
      whereConditions.push(`f.years_experience <= $${params.length + 1}`);
      params.push(parseInt(max_experience));
    }
    
    if (location) {
      whereConditions.push(`f.address ILIKE $${params.length + 1}`);
      params.push(`%${location}%`);
    }
    
    if (skills) {
      const skillArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
      
      if (skillArray.length > 0) {
        const skillConditions = skillArray.map(skill => {
          const paramIndex = params.length + 1;
          params.push(`%${skill}%`);
          return `
            EXISTS (
              SELECT 1 FROM "Freelancer_Skill" fs 
              JOIN "Skill" s ON fs.skill_id = s.skill_id 
              WHERE fs.freelancer_id = f.freelancer_id 
              AND s.name ILIKE $${paramIndex}
            )
          `;
        });
        
        whereConditions.push(`(${skillConditions.join(' OR ')})`);
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT f.freelancer_id) 
      FROM "Freelancer" f
      ${joins}
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count || '0');
    
    // FIXED: Main search query with proper COALESCE for JSON handling
    const searchQuery = `
      SELECT DISTINCT f.*, u.email, u.created_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'skill_id', s2.skill_id,
                'skill_name', s2.skill_name,
                'proficiency_level', fs2.proficiency_level,
                'years_experience', fs2.years_experience
              )
            )
            FROM "Freelancer_Skill" fs2
            JOIN "Skill" s2 ON fs2.skill_id = s2.skill_id
            WHERE fs2.freelancer_id = f.freelancer_id
          ), 
          '[]'::json
        ) as skills
      FROM "Freelancer" f
      ${joins}
      ${whereClause}
      ORDER BY f.years_experience DESC, f.freelancer_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    // Add pagination parameters
    const finalParams = [...params, parseInt(limit), offset];
    
    const searchResult = await db.query(searchQuery, finalParams);
    
    // Process results - skills are already included
    const freelancers = searchResult.rows.map(freelancer => ({
      ...freelancer,
      skills: Array.isArray(freelancer.skills) ? freelancer.skills : []
    }));
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      freelancers,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Search failed'
    });
  }
});

// FIXED: Get freelancer details with proper JSON handling
router.get('/freelancers/:id', authenticateToken, requireRole(['associate', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get freelancer details
    const freelancerResult = await db.query(
      `SELECT f.*, u.email, u.created_at, u.last_login
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       WHERE f.freelancer_id = $1`,
      [id]
    );
    
    if (freelancerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer not found'
      });
    }
    
    const freelancer = freelancerResult.rows[0];
    
    // Get skills separately
    const skillsResult = await db.query(
      `SELECT fs.*, s.name as skill_name
       FROM "Freelancer_Skill" fs
       JOIN "Skill" s ON fs.skill_id = s.skill_id
       WHERE fs.freelancer_id = $1
       ORDER BY fs.proficiency_level DESC, s.name ASC`,
      [id]
    );
    
    // Get CV info
    const cvResult = await db.query(
      'SELECT * FROM "CV" WHERE freelancer_id = $1',
      [id]
    );
    
    // Get completed contracts/jobs
    const completedJobsResult = await db.query(
      `SELECT 
         h.hire_id,
         h.created_at as hire_date,
         h.project_title,
         h.project_description,
         h.agreed_rate,
         h.rate_type,
         h.start_date,
         h.end_date,
         h.status,
         a.contact_person as company_contact,
         a.industry as company_industry
       FROM "Freelancer_Hire" h
       JOIN "Associate" a ON h.associate_id = a.associate_id
       WHERE h.freelancer_id = $1 AND h.status = 'completed'
       ORDER BY h.end_date DESC, h.created_at DESC`,
      [id]
    );
    
    // Combine all data
    const freelancerDetails = {
      ...freelancer,
      skills: skillsResult.rows,
      cv: cvResult.rows[0] || null,
      completed_jobs: completedJobsResult.rows
    };
    
    return res.status(200).json({
      success: true,
      freelancer: freelancerDetails
    });
  } catch (error) {
    console.error('Get freelancer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// FIXED: Search freelancers by skill with proper JSON handling
router.get('/freelancers/by-skill/:skillId', authenticateToken, requireRole(['associate', 'admin']), async (req, res) => {
  try {
    const { skillId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Validate skillId
    if (!skillId || isNaN(parseInt(skillId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid skill ID is required'
      });
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT f.freelancer_id) 
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      JOIN "Freelancer_Skill" fs ON f.freelancer_id = fs.freelancer_id
      WHERE fs.skill_id = $1 AND u.is_active = true
    `;
    
    const countResult = await db.query(countQuery, [skillId]);
    const totalCount = parseInt(countResult.rows[0].count || '0');
    
    // Get freelancers with this skill - without JSON aggregation in main query
    const searchQuery = `
      SELECT DISTINCT f.*, u.email, u.created_at
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      JOIN "Freelancer_Skill" fs ON f.freelancer_id = fs.freelancer_id
      WHERE fs.skill_id = $1 AND u.is_active = true
      ORDER BY fs.proficiency_level DESC, f.years_experience DESC
      LIMIT $2 OFFSET $3
    `;
    
    const searchResult = await db.query(searchQuery, [skillId, parseInt(limit), offset]);
    
    // Get skills for each freelancer separately
    const freelancers = await Promise.all(
      searchResult.rows.map(async (freelancer) => {
        const skillsQuery = `
          SELECT s.skill_id, s.name, fs.proficiency_level, fs.years_experience
          FROM "Freelancer_Skill" fs
          JOIN "Skill" s ON fs.skill_id = s.skill_id
          WHERE fs.freelancer_id = $1
          ORDER BY fs.proficiency_level DESC, s.name ASC
        `;
        
        const skillsResult = await db.query(skillsQuery, [freelancer.freelancer_id]);
        
        return {
          ...freelancer,
          skills: skillsResult.rows
        };
      })
    );
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      freelancers,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });
  } catch (error) {
    console.error('Search by skill error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all skills for search filtering
router.get('/skills', authenticateToken, requireRole(['associate', 'admin']), async (req, res) => {
  try {
    const skillsResult = await db.query(
      `SELECT s.*, COUNT(fs.freelancer_id) as freelancer_count
       FROM "Skill" s
       LEFT JOIN "Freelancer_Skill" fs ON s.skill_id = fs.skill_id
       GROUP BY s.skill_id, s.name, s.normalized_name
       ORDER BY freelancer_count DESC, s.name ASC`
    );
    
    return res.status(200).json({
      success: true,
      skills: skillsResult.rows
    });
  } catch (error) {
    console.error('Get skills error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Search associates (for freelancers to find people to message)
router.get('/associates', authenticateToken, requireRole(['freelancer', 'admin']), async (req, res) => {
  try {
    const {
      keyword,
      industry,
      page = 1,
      limit = 10
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build query parts
    let whereConditions = ['u.is_active = true'];
    const params = [];
    
    // Add search conditions
    if (keyword) {
      whereConditions.push(`(
        a.contact_person ILIKE $${params.length + 1} OR
        a.company_name ILIKE $${params.length + 1} OR
        a.industry ILIKE $${params.length + 1} OR
        u.email ILIKE $${params.length + 1}
      )`);
      params.push(`%${keyword}%`);
    }
    
    if (industry) {
      whereConditions.push(`a.industry ILIKE $${params.length + 1}`);
      params.push(`%${industry}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT a.associate_id) 
      FROM "Associate" a
      JOIN "User" u ON a.user_id = u.user_id
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count || '0');
    
    // Main search query
    const searchQuery = `
      SELECT DISTINCT a.*, u.email, u.created_at
      FROM "Associate" a
      JOIN "User" u ON a.user_id = u.user_id
      ${whereClause}
      ORDER BY a.associate_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    // Add pagination parameters
    const finalParams = [...params, parseInt(limit), offset];
    
    const searchResult = await db.query(searchQuery, finalParams);
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      associates: searchResult.rows,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });
    
  } catch (error) {
    console.error('Search associates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
