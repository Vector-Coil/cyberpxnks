-- Auto-grant subnet access when protocol is unlocked
-- This trigger ensures that when a user unlocks a protocol, they also get access to its related subnet

DELIMITER $$

CREATE TRIGGER after_protocol_access_insert
AFTER INSERT ON user_protocol_access
FOR EACH ROW
BEGIN
    DECLARE related_subnet_id INT;
    
    -- Get the subnet_id for this protocol
    SELECT subnet_id INTO related_subnet_id
    FROM protocols
    WHERE id = NEW.protocol_id
    LIMIT 1;
    
    -- If the protocol has a related subnet, grant access to it
    IF related_subnet_id IS NOT NULL THEN
        -- Insert subnet access if it doesn't already exist
        INSERT IGNORE INTO user_subnet_access (user_id, subnet_id, unlock_method, unlocked_at)
        VALUES (NEW.user_id, related_subnet_id, 'protocol_unlock', NEW.unlocked_at);
    END IF;
END$$

DELIMITER ;

-- Test: View the trigger
SHOW TRIGGERS LIKE 'user_protocol_access';
