-- Patch v21: Automatically derive missing student departments and roll numbers

-- 1. Derive department based on email domain for students where department is missing or empty
UPDATE profiles
SET department = CASE
    WHEN email LIKE '%@cse.suh.edu.in' THEN 'CSE'
    WHEN email LIKE '%@aiml.suh.edu.in' THEN 'AIML'
    WHEN email LIKE '%@sap.suh.edu.in' THEN 'SAP'
    WHEN email LIKE '%@cs.suh.edu.in' THEN 'CS'
    WHEN email LIKE '%@ds.suh.edu.in' THEN 'DS'
    ELSE department
  END
WHERE (role = 'student' OR role = 'student_organizer') 
  AND (department IS NULL OR department = '');

-- 2. Derive roll number based on email prefix for students where roll number is missing or empty
UPDATE profiles
SET roll_number = split_part(email, '@', 1)
WHERE (role = 'student' OR role = 'student_organizer') 
  AND (roll_number IS NULL OR roll_number = '');
