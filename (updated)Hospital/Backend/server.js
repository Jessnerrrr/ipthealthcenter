const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');

const app = express();
const port = 8080;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
// Allow browser to see uploaded images
app.use('/uploads', express.static('uploads')); 

// --- DATABASE CONNECTION ---
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'barangayhealthcenter',
  password: 'samganda', // Ensure this matches your pgAdmin password
  port: 5432,
});

// --- IMAGE UPLOAD CONFIGURATION ---
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });


// --- ROUTES ---

// 1. Test Route
app.get('/', (req, res) => {
  res.send('Server is connected to database: barangayhealthcenter');
});

// 2. Register New User
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, password]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Registration Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 3. Book Appointment
app.post('/book-appointment', async (req, res) => {
  const { patient_id, appointment_date, reason } = req.body;
  try {
    const query = `
      INSERT INTO appointments (patient_id, appointment_date, reason, status) 
      VALUES ($1, $2, $3, 'Pending') 
      RETURNING *
    `;
    const result = await pool.query(query, [patient_id, appointment_date, reason]);
    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) {
    console.error("Booking Error:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// 4. Get My Appointments
app.get('/my-appointments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appointments ORDER BY appointment_date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 8. Get User Profile (FIXED: Reads separate names and combines them)
app.get('/get-user-profile', async (req, res) => {
  const userId = 1; 
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = result.rows[0];
    
    // Safely combine the first and last name from the database for the front-end to split
    const combinedName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    
    res.json({ 
      success: true, 
      user: {
        name: combinedName, // Sends combined name
        email: user.email,
        phone: user.phone || user.contact_number || "", 
        address: user.address || "",
        profile_picture: user.profile_picture
      }
    });

  } catch (err) {
    console.error("Profile Fetch Error:", err.message);
    res.status(500).json({ success: false, error: "Server Error" });
  }
});
// 9. Update User Text Details (FIXED: Uses separate columns for names)
app.post('/update-user-details', async (req, res) => {
  const { userId, firstName, lastName, phone, address } = req.body;
  
  try {
    // FIX: Update first_name, last_name, phone, and address separately
    const query = `
      UPDATE users 
      SET first_name = $1, last_name = $2, phone = $3, address = $4 
      WHERE user_id = $5 
      RETURNING *
    `;
    
    // Values match the 5 parameters in the query
    const values = [firstName, lastName, phone, address, userId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, message: "Details updated successfully" });

  } catch (err) {
    console.error("Update Details Error:", err.message);
    res.status(500).json({ success: false, error: "Database error: " + err.message });
  }
});
// 10. Update Profile Picture
app.post('/update-profile-picture', upload.single('profilePhoto'), async (req, res) => {
    const { userId } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const imagePath = req.file.path.replace(/\\/g, "/");

    try {
        const query = 'UPDATE users SET profile_picture = $1 WHERE user_id = $2 RETURNING *';
        const result = await pool.query(query, [imagePath, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({ success: true, imagePath: imagePath });
    } catch (err) {
        console.error("Image Upload Error:", err.message);
        res.status(500).json({ success: false, error: "Database error" });
    }
});
// NEW ROUTE: 11. Cancel Appointment
app.post('/cancel-appointment', async (req, res) => {
    const { id } = req.body; // Expects the appointment_id

    try {
        const query = `
            UPDATE appointments
            SET status = 'Cancelled' 
            WHERE appointment_id = $1 
            RETURNING *
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Appointment not found." });
        }

        res.json({ success: true, message: "Appointment cancelled." });

    } catch (err) {
        console.error("Cancellation Error:", err.message);
        res.status(500).json({ success: false, error: "Database error during cancellation." });
    }
});
// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});