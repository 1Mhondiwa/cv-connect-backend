-- Migration: Auto-update expired contracts to completed status
-- This migration creates a function and trigger to automatically update expired contracts

-- Create function to update expired contracts
CREATE OR REPLACE FUNCTION update_expired_contracts()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update all active contracts where expected_end_date has passed
    UPDATE "Freelancer_Hire" 
    SET 
        status = 'completed',
        actual_end_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        status = 'active' 
        AND expected_end_date IS NOT NULL 
        AND expected_end_date < CURRENT_DATE;
    
    -- Get the number of updated records
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the update if any contracts were updated
    IF updated_count > 0 THEN
        RAISE NOTICE 'Updated % expired contracts to completed status', updated_count;
    END IF;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function that runs the update function
CREATE OR REPLACE FUNCTION trigger_update_expired_contracts()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the update function
    PERFORM update_expired_contracts();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION update_expired_contracts() IS 'Automatically updates expired contracts from active to completed status';
COMMENT ON FUNCTION trigger_update_expired_contracts() IS 'Trigger function to update expired contracts when any hire record is accessed';
