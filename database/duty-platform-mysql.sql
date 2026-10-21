/* =====================================================================
   School Duty Platform - version 1 (standalone prototype)
   MySQL 8.0.19 or newer. Re-runnable: it drops and recreates the whole
   database and loads DUMMY data. Run it in MySQL Workbench to reset.
   Roles: teacher, supervisor, head_of_stage, admin, matron, hr.
   Stages: Foundation, Elementary, Middle & High.
   day_of_week: 0 = Sunday, 1 = Monday ... 4 = Thursday
   Demo data: all three stages have schedules.
   ===================================================================== */
SET SQL_SAFE_UPDATES = 0;
DROP DATABASE IF EXISTS duty_platform;
CREATE DATABASE duty_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE duty_platform;

-- 1. Tables
CREATE TABLE stages (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE areas (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);
CREATE TABLE duty_types (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  code   VARCHAR(40) NOT NULL UNIQUE,   -- snack, break, dismissal, after-school-program ...
  name   VARCHAR(50) NOT NULL,
  colour VARCHAR(7)  NOT NULL DEFAULT '#6b7a90',   -- shown in the schedules
  weight DECIMAL(4,1) NOT NULL DEFAULT 1           -- for workload later
);
CREATE TABLE users (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL UNIQUE,
  email     VARCHAR(150) NOT NULL UNIQUE,
  role      VARCHAR(20)  NOT NULL,
  stage_id  INT NULL,                 -- home stage (optional): the stage of a duty comes from duty_slots
  subject   VARCHAR(60) NULL,
  CONSTRAINT chk_users_role CHECK (role IN ('teacher','supervisor','head_of_stage','admin','matron','hr')),
  CONSTRAINT fk_users_stage FOREIGN KEY (stage_id) REFERENCES stages(id)
);
CREATE TABLE duty_slots (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  stage_id     INT NOT NULL,
  duty_type_id INT NOT NULL,
  area_id      INT NOT NULL,
  day_of_week  TINYINT NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  CONSTRAINT chk_slot_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_slot_time CHECK (end_time > start_time),
  CONSTRAINT fk_slot_stage FOREIGN KEY (stage_id) REFERENCES stages(id),
  CONSTRAINT fk_slot_type FOREIGN KEY (duty_type_id) REFERENCES duty_types(id),
  CONSTRAINT fk_slot_area FOREIGN KEY (area_id) REFERENCES areas(id)
);
CREATE TABLE assignments (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  slot_id INT NOT NULL,
  user_id INT NOT NULL,
  CONSTRAINT uq_assignment UNIQUE (slot_id, user_id),
  CONSTRAINT fk_assign_slot FOREIGN KEY (slot_id) REFERENCES duty_slots(id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE attendance_records (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  duty_date     DATE NOT NULL,
  status        VARCHAR(12) NOT NULL DEFAULT 'unmarked',
  marked_by     INT NULL,
  marked_at     DATETIME NULL,
  note          VARCHAR(250) NULL,
  CONSTRAINT uq_attendance UNIQUE (assignment_id, duty_date),
  CONSTRAINT chk_att_status CHECK (status IN ('unmarked','present','late','absent','substituted')),
  CONSTRAINT fk_att_assign FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_marker FOREIGN KEY (marked_by) REFERENCES users(id)
);
CREATE TABLE substitutions (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id      INT NOT NULL,
  duty_date          DATE NOT NULL,
  substitute_user_id INT NOT NULL,
  added_by           INT NOT NULL,            -- the supervisor
  reason             VARCHAR(250) NULL,
  status             VARCHAR(10) NOT NULL DEFAULT 'unmarked',  -- the substitute's own attendance
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_substitution UNIQUE (assignment_id, duty_date),
  CONSTRAINT chk_sub_status CHECK (status IN ('unmarked','present','late','absent')),
  CONSTRAINT fk_sub_assign FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_user FOREIGN KEY (substitute_user_id) REFERENCES users(id),
  CONSTRAINT fk_sub_added FOREIGN KEY (added_by) REFERENCES users(id)
);
CREATE TABLE emergency_reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,                   -- the teacher who reports
  report_date DATE NOT NULL,                  -- covers all duties of that day
  message     VARCHAR(250) NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'open',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_emerg_status CHECK (status IN ('open','handled')),
  CONSTRAINT fk_emerg_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 2. Reference data
INSERT INTO stages(name) VALUES ('Foundation'),('Elementary'),('Middle & High');
INSERT INTO duty_types(code,name,colour,weight) VALUES
 ('snack','Snack','#2f6fb5',1),('break','Break','#c9820a',1),('dismissal','Dismissal','#7a4fb0',1);
INSERT INTO areas(name) VALUES ('Soccer Field'), ('Basketball Field'), ('Rainbow Lane'), ('Cafeteria'), ('Garage'), ('Basketball'), ('Gate 7');

-- 3. People (dummy). Specialist teachers (French, Music, German) have no home stage.
INSERT INTO users(full_name,email,role,stage_id,subject) VALUES
 ('Admin 01','admin01@example.com','admin',NULL,NULL),
 ('Supervisor 01','supervisor01@example.com','supervisor',NULL,NULL),
 ('Head of Foundation','head.foundation@example.com','head_of_stage',(SELECT id FROM stages WHERE name='Foundation'),NULL),
 ('Head of Elementary','head.elementary@example.com','head_of_stage',(SELECT id FROM stages WHERE name='Elementary'),NULL),
 ('Head of Middle & High','head.middlehigh@example.com','head_of_stage',(SELECT id FROM stages WHERE name='Middle & High'),NULL),
 ('Teacher 01','teacher01@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Math'),
 ('Teacher 02','teacher02@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'ELA'),
 ('Teacher 03','teacher03@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Science'),
 ('Teacher 04','teacher04@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Arabic'),
 ('Teacher 05','teacher05@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'STEM'),
 ('Teacher 06','teacher06@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Social Studies'),
 ('Teacher 07','teacher07@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Art'),
 ('Teacher 08','teacher08@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Character Building'),
 ('Teacher 09','teacher09@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'CS'),
 ('Teacher 10','teacher10@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'ESS'),
 ('Teacher 11','teacher11@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'Drama'),
 ('Teacher 12','teacher12@example.com','teacher',(SELECT id FROM stages WHERE name='Foundation'),'PE'),
 ('Teacher 13','teacher13@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Math'),
 ('Teacher 14','teacher14@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'ELA'),
 ('Teacher 15','teacher15@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Science'),
 ('Teacher 16','teacher16@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Arabic'),
 ('Teacher 17','teacher17@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'STEM'),
 ('Teacher 18','teacher18@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Social Studies'),
 ('Teacher 19','teacher19@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Art'),
 ('Teacher 20','teacher20@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Character Building'),
 ('Teacher 21','teacher21@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'CS'),
 ('Teacher 22','teacher22@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'ESS'),
 ('Teacher 23','teacher23@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'Drama'),
 ('Teacher 24','teacher24@example.com','teacher',(SELECT id FROM stages WHERE name='Elementary'),'PE'),
 ('Teacher 25','teacher25@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Math'),
 ('Teacher 26','teacher26@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'ELA'),
 ('Teacher 27','teacher27@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Science'),
 ('Teacher 28','teacher28@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Arabic'),
 ('Teacher 29','teacher29@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'STEM'),
 ('Teacher 30','teacher30@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Social Studies'),
 ('Teacher 31','teacher31@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Art'),
 ('Teacher 32','teacher32@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Character Building'),
 ('Teacher 33','teacher33@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'CS'),
 ('Teacher 34','teacher34@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'ESS'),
 ('Teacher 35','teacher35@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Drama'),
 ('Teacher 36','teacher36@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'PE'),
 ('Teacher 37','teacher37@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Math'),
 ('Teacher 38','teacher38@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'ELA'),
 ('Teacher 39','teacher39@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Science'),
 ('Teacher 40','teacher40@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Arabic'),
 ('Teacher 41','teacher41@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'STEM'),
 ('Teacher 42','teacher42@example.com','teacher',(SELECT id FROM stages WHERE name='Middle & High'),'Social Studies'),
 ('Teacher 43','teacher43@example.com','teacher',NULL,'French'),
 ('Teacher 44','teacher44@example.com','teacher',NULL,'Music'),
 ('Teacher 45','teacher45@example.com','teacher',NULL,'German');

-- 4. Duty plan (dummy): stage, day, type, place, times, teacher
CREATE TEMPORARY TABLE plan (
  stage VARCHAR(50), day_of_week TINYINT, type_code VARCHAR(20), area VARCHAR(80),
  start_time TIME, end_time TIME, full_name VARCHAR(100));
INSERT INTO plan VALUES
  ('Foundation',0,'snack','Soccer Field','08:45','09:00','Teacher 01'),
  ('Foundation',0,'snack','Basketball Field','08:45','09:00','Teacher 02'),
  ('Foundation',0,'snack','Cafeteria','08:45','09:00','Teacher 03'),
  ('Foundation',0,'break','Soccer Field','12:00','12:30','Teacher 04'),
  ('Foundation',0,'break','Basketball Field','12:00','12:30','Teacher 05'),
  ('Foundation',0,'break','Rainbow Lane','12:00','12:30','Teacher 06'),
  ('Foundation',0,'break','Cafeteria','12:00','12:30','Teacher 07'),
  ('Foundation',0,'break','Cafeteria','12:00','12:30','Teacher 08'),
  ('Foundation',0,'dismissal','Garage','14:00','14:15','Teacher 09'),
  ('Foundation',0,'dismissal','Garage','14:00','14:15','Teacher 10'),
  ('Foundation',0,'dismissal','Basketball','14:00','14:15','Teacher 11'),
  ('Foundation',0,'dismissal','Gate 7','14:00','14:15','Teacher 12'),
  ('Foundation',0,'dismissal','Gate 7','14:00','14:15','Teacher 43'),
  ('Foundation',1,'snack','Soccer Field','08:45','09:00','Teacher 44'),
  ('Foundation',1,'snack','Basketball Field','08:45','09:00','Teacher 45'),
  ('Foundation',1,'snack','Cafeteria','08:45','09:00','Teacher 01'),
  ('Foundation',1,'break','Soccer Field','12:00','12:30','Teacher 02'),
  ('Foundation',1,'break','Basketball Field','12:00','12:30','Teacher 03'),
  ('Foundation',1,'break','Rainbow Lane','12:00','12:30','Teacher 04'),
  ('Foundation',1,'break','Cafeteria','12:00','12:30','Teacher 05'),
  ('Foundation',1,'break','Cafeteria','12:00','12:30','Teacher 06'),
  ('Foundation',1,'dismissal','Garage','14:00','14:15','Teacher 07'),
  ('Foundation',1,'dismissal','Garage','14:00','14:15','Teacher 08'),
  ('Foundation',1,'dismissal','Basketball','14:00','14:15','Teacher 09'),
  ('Foundation',1,'dismissal','Gate 7','14:00','14:15','Teacher 10'),
  ('Foundation',1,'dismissal','Gate 7','14:00','14:15','Teacher 11'),
  ('Foundation',2,'snack','Soccer Field','08:45','09:00','Teacher 12'),
  ('Foundation',2,'snack','Basketball Field','08:45','09:00','Teacher 43'),
  ('Foundation',2,'snack','Cafeteria','08:45','09:00','Teacher 44'),
  ('Foundation',2,'break','Soccer Field','12:00','12:30','Teacher 45'),
  ('Foundation',2,'break','Basketball Field','12:00','12:30','Teacher 01'),
  ('Foundation',2,'break','Rainbow Lane','12:00','12:30','Teacher 02'),
  ('Foundation',2,'break','Cafeteria','12:00','12:30','Teacher 03'),
  ('Foundation',2,'break','Cafeteria','12:00','12:30','Teacher 04'),
  ('Foundation',2,'dismissal','Garage','14:00','14:15','Teacher 05'),
  ('Foundation',2,'dismissal','Garage','14:00','14:15','Teacher 06'),
  ('Foundation',2,'dismissal','Basketball','14:00','14:15','Teacher 07'),
  ('Foundation',2,'dismissal','Gate 7','14:00','14:15','Teacher 08'),
  ('Foundation',2,'dismissal','Gate 7','14:00','14:15','Teacher 09'),
  ('Foundation',3,'snack','Soccer Field','08:45','09:00','Teacher 10'),
  ('Foundation',3,'snack','Basketball Field','08:45','09:00','Teacher 11'),
  ('Foundation',3,'snack','Cafeteria','08:45','09:00','Teacher 12'),
  ('Foundation',3,'break','Soccer Field','12:00','12:30','Teacher 43'),
  ('Foundation',3,'break','Basketball Field','12:00','12:30','Teacher 44'),
  ('Foundation',3,'break','Rainbow Lane','12:00','12:30','Teacher 45'),
  ('Foundation',3,'break','Cafeteria','12:00','12:30','Teacher 01'),
  ('Foundation',3,'break','Cafeteria','12:00','12:30','Teacher 02'),
  ('Foundation',3,'dismissal','Garage','14:00','14:15','Teacher 03'),
  ('Foundation',3,'dismissal','Garage','14:00','14:15','Teacher 04'),
  ('Foundation',3,'dismissal','Basketball','14:00','14:15','Teacher 05'),
  ('Foundation',3,'dismissal','Gate 7','14:00','14:15','Teacher 06'),
  ('Foundation',3,'dismissal','Gate 7','14:00','14:15','Teacher 07'),
  ('Foundation',4,'snack','Soccer Field','08:45','09:00','Teacher 08'),
  ('Foundation',4,'snack','Basketball Field','08:45','09:00','Teacher 09'),
  ('Foundation',4,'snack','Cafeteria','08:45','09:00','Teacher 10'),
  ('Foundation',4,'break','Soccer Field','12:00','12:30','Teacher 11'),
  ('Foundation',4,'break','Basketball Field','12:00','12:30','Teacher 12'),
  ('Foundation',4,'break','Rainbow Lane','12:00','12:30','Teacher 43'),
  ('Foundation',4,'break','Cafeteria','12:00','12:30','Teacher 44'),
  ('Foundation',4,'break','Cafeteria','12:00','12:30','Teacher 45'),
  ('Foundation',4,'dismissal','Garage','14:00','14:15','Teacher 01'),
  ('Foundation',4,'dismissal','Garage','14:00','14:15','Teacher 02'),
  ('Foundation',4,'dismissal','Basketball','14:00','14:15','Teacher 03'),
  ('Foundation',4,'dismissal','Gate 7','14:00','14:15','Teacher 04'),
  ('Foundation',4,'dismissal','Gate 7','14:00','14:15','Teacher 05'),
  ('Elementary',0,'snack','Soccer Field','09:05','09:20','Teacher 17'),
  ('Elementary',0,'snack','Basketball Field','09:05','09:20','Teacher 18'),
  ('Elementary',0,'snack','Cafeteria','09:05','09:20','Teacher 19'),
  ('Elementary',0,'break','Soccer Field','12:35','13:05','Teacher 20'),
  ('Elementary',0,'break','Basketball Field','12:35','13:05','Teacher 21'),
  ('Elementary',0,'break','Rainbow Lane','12:35','13:05','Teacher 22'),
  ('Elementary',0,'break','Cafeteria','12:35','13:05','Teacher 23'),
  ('Elementary',0,'break','Cafeteria','12:35','13:05','Teacher 24'),
  ('Elementary',0,'dismissal','Garage','14:20','14:35','Teacher 43'),
  ('Elementary',0,'dismissal','Garage','14:20','14:35','Teacher 44'),
  ('Elementary',0,'dismissal','Basketball','14:20','14:35','Teacher 45'),
  ('Elementary',0,'dismissal','Gate 7','14:20','14:35','Teacher 13'),
  ('Elementary',0,'dismissal','Gate 7','14:20','14:35','Teacher 14'),
  ('Elementary',1,'snack','Soccer Field','09:05','09:20','Teacher 15'),
  ('Elementary',1,'snack','Basketball Field','09:05','09:20','Teacher 16'),
  ('Elementary',1,'snack','Cafeteria','09:05','09:20','Teacher 17'),
  ('Elementary',1,'break','Soccer Field','12:35','13:05','Teacher 18'),
  ('Elementary',1,'break','Basketball Field','12:35','13:05','Teacher 19'),
  ('Elementary',1,'break','Rainbow Lane','12:35','13:05','Teacher 20'),
  ('Elementary',1,'break','Cafeteria','12:35','13:05','Teacher 21'),
  ('Elementary',1,'break','Cafeteria','12:35','13:05','Teacher 22'),
  ('Elementary',1,'dismissal','Garage','14:20','14:35','Teacher 23'),
  ('Elementary',1,'dismissal','Garage','14:20','14:35','Teacher 24'),
  ('Elementary',1,'dismissal','Basketball','14:20','14:35','Teacher 43'),
  ('Elementary',1,'dismissal','Gate 7','14:20','14:35','Teacher 44'),
  ('Elementary',1,'dismissal','Gate 7','14:20','14:35','Teacher 45'),
  ('Elementary',2,'snack','Soccer Field','09:05','09:20','Teacher 13'),
  ('Elementary',2,'snack','Basketball Field','09:05','09:20','Teacher 14'),
  ('Elementary',2,'snack','Cafeteria','09:05','09:20','Teacher 15'),
  ('Elementary',2,'break','Soccer Field','12:35','13:05','Teacher 16'),
  ('Elementary',2,'break','Basketball Field','12:35','13:05','Teacher 17'),
  ('Elementary',2,'break','Rainbow Lane','12:35','13:05','Teacher 18'),
  ('Elementary',2,'break','Cafeteria','12:35','13:05','Teacher 19'),
  ('Elementary',2,'break','Cafeteria','12:35','13:05','Teacher 20'),
  ('Elementary',2,'dismissal','Garage','14:20','14:35','Teacher 21'),
  ('Elementary',2,'dismissal','Garage','14:20','14:35','Teacher 22'),
  ('Elementary',2,'dismissal','Basketball','14:20','14:35','Teacher 23'),
  ('Elementary',2,'dismissal','Gate 7','14:20','14:35','Teacher 24'),
  ('Elementary',2,'dismissal','Gate 7','14:20','14:35','Teacher 43'),
  ('Elementary',3,'snack','Soccer Field','09:05','09:20','Teacher 44'),
  ('Elementary',3,'snack','Basketball Field','09:05','09:20','Teacher 45'),
  ('Elementary',3,'snack','Cafeteria','09:05','09:20','Teacher 13'),
  ('Elementary',3,'break','Soccer Field','12:35','13:05','Teacher 14'),
  ('Elementary',3,'break','Basketball Field','12:35','13:05','Teacher 15'),
  ('Elementary',3,'break','Rainbow Lane','12:35','13:05','Teacher 16'),
  ('Elementary',3,'break','Cafeteria','12:35','13:05','Teacher 17'),
  ('Elementary',3,'break','Cafeteria','12:35','13:05','Teacher 18'),
  ('Elementary',3,'dismissal','Garage','14:20','14:35','Teacher 19'),
  ('Elementary',3,'dismissal','Garage','14:20','14:35','Teacher 20'),
  ('Elementary',3,'dismissal','Basketball','14:20','14:35','Teacher 21'),
  ('Elementary',3,'dismissal','Gate 7','14:20','14:35','Teacher 22'),
  ('Elementary',3,'dismissal','Gate 7','14:20','14:35','Teacher 23'),
  ('Elementary',4,'snack','Soccer Field','09:05','09:20','Teacher 24'),
  ('Elementary',4,'snack','Basketball Field','09:05','09:20','Teacher 43'),
  ('Elementary',4,'snack','Cafeteria','09:05','09:20','Teacher 44'),
  ('Elementary',4,'break','Soccer Field','12:35','13:05','Teacher 45'),
  ('Elementary',4,'break','Basketball Field','12:35','13:05','Teacher 13'),
  ('Elementary',4,'break','Rainbow Lane','12:35','13:05','Teacher 14'),
  ('Elementary',4,'break','Cafeteria','12:35','13:05','Teacher 15'),
  ('Elementary',4,'break','Cafeteria','12:35','13:05','Teacher 16'),
  ('Elementary',4,'dismissal','Garage','14:20','14:35','Teacher 17'),
  ('Elementary',4,'dismissal','Garage','14:20','14:35','Teacher 18'),
  ('Elementary',4,'dismissal','Basketball','14:20','14:35','Teacher 19'),
  ('Elementary',4,'dismissal','Gate 7','14:20','14:35','Teacher 20'),
  ('Elementary',4,'dismissal','Gate 7','14:20','14:35','Teacher 21'),
  ('Middle & High',0,'snack','Soccer Field','09:25','09:40','Teacher 34'),
  ('Middle & High',0,'snack','Basketball Field','09:25','09:40','Teacher 35'),
  ('Middle & High',0,'snack','Cafeteria','09:25','09:40','Teacher 36'),
  ('Middle & High',0,'break','Soccer Field','13:10','13:40','Teacher 43'),
  ('Middle & High',0,'break','Basketball Field','13:10','13:40','Teacher 44'),
  ('Middle & High',0,'break','Rainbow Lane','13:10','13:40','Teacher 45'),
  ('Middle & High',0,'break','Cafeteria','13:10','13:40','Teacher 25'),
  ('Middle & High',0,'break','Cafeteria','13:10','13:40','Teacher 26'),
  ('Middle & High',0,'dismissal','Garage','14:40','14:55','Teacher 27'),
  ('Middle & High',0,'dismissal','Garage','14:40','14:55','Teacher 28'),
  ('Middle & High',0,'dismissal','Basketball','14:40','14:55','Teacher 29'),
  ('Middle & High',0,'dismissal','Gate 7','14:40','14:55','Teacher 30'),
  ('Middle & High',0,'dismissal','Gate 7','14:40','14:55','Teacher 31'),
  ('Middle & High',1,'snack','Soccer Field','09:25','09:40','Teacher 32'),
  ('Middle & High',1,'snack','Basketball Field','09:25','09:40','Teacher 33'),
  ('Middle & High',1,'snack','Cafeteria','09:25','09:40','Teacher 34'),
  ('Middle & High',1,'break','Soccer Field','13:10','13:40','Teacher 35'),
  ('Middle & High',1,'break','Basketball Field','13:10','13:40','Teacher 36'),
  ('Middle & High',1,'break','Rainbow Lane','13:10','13:40','Teacher 43'),
  ('Middle & High',1,'break','Cafeteria','13:10','13:40','Teacher 44'),
  ('Middle & High',1,'break','Cafeteria','13:10','13:40','Teacher 45'),
  ('Middle & High',1,'dismissal','Garage','14:40','14:55','Teacher 25'),
  ('Middle & High',1,'dismissal','Garage','14:40','14:55','Teacher 26'),
  ('Middle & High',1,'dismissal','Basketball','14:40','14:55','Teacher 27'),
  ('Middle & High',1,'dismissal','Gate 7','14:40','14:55','Teacher 28'),
  ('Middle & High',1,'dismissal','Gate 7','14:40','14:55','Teacher 29'),
  ('Middle & High',2,'snack','Soccer Field','09:25','09:40','Teacher 30'),
  ('Middle & High',2,'snack','Basketball Field','09:25','09:40','Teacher 31'),
  ('Middle & High',2,'snack','Cafeteria','09:25','09:40','Teacher 32'),
  ('Middle & High',2,'break','Soccer Field','13:10','13:40','Teacher 33'),
  ('Middle & High',2,'break','Basketball Field','13:10','13:40','Teacher 34'),
  ('Middle & High',2,'break','Rainbow Lane','13:10','13:40','Teacher 35'),
  ('Middle & High',2,'break','Cafeteria','13:10','13:40','Teacher 36'),
  ('Middle & High',2,'break','Cafeteria','13:10','13:40','Teacher 43'),
  ('Middle & High',2,'dismissal','Garage','14:40','14:55','Teacher 44'),
  ('Middle & High',2,'dismissal','Garage','14:40','14:55','Teacher 45'),
  ('Middle & High',2,'dismissal','Basketball','14:40','14:55','Teacher 25'),
  ('Middle & High',2,'dismissal','Gate 7','14:40','14:55','Teacher 26'),
  ('Middle & High',2,'dismissal','Gate 7','14:40','14:55','Teacher 27'),
  ('Middle & High',3,'snack','Soccer Field','09:25','09:40','Teacher 28'),
  ('Middle & High',3,'snack','Basketball Field','09:25','09:40','Teacher 29'),
  ('Middle & High',3,'snack','Cafeteria','09:25','09:40','Teacher 30'),
  ('Middle & High',3,'break','Soccer Field','13:10','13:40','Teacher 31'),
  ('Middle & High',3,'break','Basketball Field','13:10','13:40','Teacher 32'),
  ('Middle & High',3,'break','Rainbow Lane','13:10','13:40','Teacher 33'),
  ('Middle & High',3,'break','Cafeteria','13:10','13:40','Teacher 34'),
  ('Middle & High',3,'break','Cafeteria','13:10','13:40','Teacher 35'),
  ('Middle & High',3,'dismissal','Garage','14:40','14:55','Teacher 36'),
  ('Middle & High',3,'dismissal','Garage','14:40','14:55','Teacher 43'),
  ('Middle & High',3,'dismissal','Basketball','14:40','14:55','Teacher 44'),
  ('Middle & High',3,'dismissal','Gate 7','14:40','14:55','Teacher 45'),
  ('Middle & High',3,'dismissal','Gate 7','14:40','14:55','Teacher 25'),
  ('Middle & High',4,'snack','Soccer Field','09:25','09:40','Teacher 26'),
  ('Middle & High',4,'snack','Basketball Field','09:25','09:40','Teacher 27'),
  ('Middle & High',4,'snack','Cafeteria','09:25','09:40','Teacher 28'),
  ('Middle & High',4,'break','Soccer Field','13:10','13:40','Teacher 29'),
  ('Middle & High',4,'break','Basketball Field','13:10','13:40','Teacher 30'),
  ('Middle & High',4,'break','Rainbow Lane','13:10','13:40','Teacher 31'),
  ('Middle & High',4,'break','Cafeteria','13:10','13:40','Teacher 32'),
  ('Middle & High',4,'break','Cafeteria','13:10','13:40','Teacher 33'),
  ('Middle & High',4,'dismissal','Garage','14:40','14:55','Teacher 34'),
  ('Middle & High',4,'dismissal','Garage','14:40','14:55','Teacher 35'),
  ('Middle & High',4,'dismissal','Basketball','14:40','14:55','Teacher 36'),
  ('Middle & High',4,'dismissal','Gate 7','14:40','14:55','Teacher 43'),
  ('Middle & High',4,'dismissal','Gate 7','14:40','14:55','Teacher 44');

INSERT INTO duty_slots(stage_id,duty_type_id,area_id,day_of_week,start_time,end_time)
SELECT DISTINCT s.id, t.id, a.id, p.day_of_week, p.start_time, p.end_time
FROM plan p
JOIN stages s ON s.name = p.stage
JOIN duty_types t ON t.code = p.type_code
JOIN areas a ON a.name = p.area;

INSERT INTO assignments(slot_id,user_id)
SELECT sl.id, u.id
FROM plan p
JOIN stages s ON s.name = p.stage
JOIN duty_types t ON t.code = p.type_code
JOIN areas a ON a.name = p.area
JOIN duty_slots sl ON sl.stage_id=s.id AND sl.duty_type_id=t.id AND sl.area_id=a.id AND sl.day_of_week=p.day_of_week
JOIN users u ON u.full_name = p.full_name;
DROP TEMPORARY TABLE plan;

-- 5. Four past weeks of attendance (random, mostly present)
SET @yesterday = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
SET @supervisor = (SELECT id FROM users WHERE role='supervisor');
INSERT INTO attendance_records(assignment_id,duty_date,status,marked_by,marked_at)
SELECT x.assignment_id, x.duty_date,
       CASE WHEN x.r < 80 THEN 'present' WHEN x.r < 92 THEN 'late' ELSE 'absent' END,
       @supervisor, NOW()
FROM (
  SELECT a.id AS assignment_id,
         DATE_SUB(
           DATE_SUB(@yesterday, INTERVAL MOD(MOD(DAYOFWEEK(@yesterday)-1,7) - sl.day_of_week + 7, 7) DAY),
           INTERVAL 7*(w.n-1) DAY) AS duty_date,
         FLOOR(RAND()*100) AS r
  FROM assignments a
  JOIN duty_slots sl ON sl.id = a.slot_id
  CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) w
) x;

-- 6. One example emergency with a substitute (Elementary, Sunday break, cafeteria)
SET @a = (SELECT a.id FROM assignments a
          JOIN users u ON u.id=a.user_id
          JOIN duty_slots sl ON sl.id=a.slot_id
          JOIN duty_types t ON t.id=sl.duty_type_id
          JOIN areas ar ON ar.id=sl.area_id
          JOIN stages s ON s.id=sl.stage_id
          WHERE u.full_name='Teacher 23' AND t.code='break' AND ar.name='Cafeteria'
            AND s.name='Elementary' AND sl.day_of_week=0
          LIMIT 1);
SET @d = (SELECT MAX(duty_date) FROM attendance_records WHERE assignment_id=@a);
UPDATE attendance_records SET status='substituted' WHERE assignment_id=@a AND duty_date=@d;
INSERT INTO substitutions(assignment_id,duty_date,substitute_user_id,added_by,reason,status)
VALUES (@a,@d,(SELECT id FROM users WHERE full_name='Teacher 15'),@supervisor,'Emergency reported by the teacher','present');
INSERT INTO emergency_reports(user_id,report_date,message,status)
VALUES ((SELECT user_id FROM assignments WHERE id=@a),@d,'Family emergency','handled');

-- 7. Quick checks (expected: 50, 150, 195, 780, 1)
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'duty_slots', COUNT(*) FROM duty_slots
UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL SELECT 'substitutions', COUNT(*) FROM substitutions;


