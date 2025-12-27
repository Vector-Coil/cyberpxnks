-- Add subnet_id column to protocols table
-- This links protocols to their associated subnets

-- Add the column (will error if it already exists - that's ok, just skip to next step)
ALTER TABLE protocols 
ADD COLUMN subnet_id INT NULL AFTER controlling_alignment_id;

-- Add foreign key constraint (will error if it already exists - safe to ignore)
ALTER TABLE protocols
ADD CONSTRAINT fk_protocol_subnet 
FOREIGN KEY (subnet_id) REFERENCES subnets(id) ON DELETE SET NULL;

-- Add index for better query performance (will error if exists - safe to ignore)
CREATE INDEX idx_protocol_subnet ON protocols(subnet_id);
