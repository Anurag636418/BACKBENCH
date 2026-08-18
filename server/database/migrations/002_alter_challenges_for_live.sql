-- Drop old "beat my score" columns
ALTER TABLE challenges DROP COLUMN IF EXISTS creator_score;
ALTER TABLE challenges DROP COLUMN IF EXISTS creator_name;

-- Add live challenge columns
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS room_id VARCHAR(100);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS player1_name VARCHAR(50);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS player2_name VARCHAR(50);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS winner VARCHAR(10);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS player1_score INT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS player2_score INT;
