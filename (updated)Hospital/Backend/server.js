const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 8080;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());

// --- DATABASE CONNECTION ---
const pool = new Pool({
  user: 'postgres',             // Default user
  host: 'localhost',            // Localhost
  database: 'barangayhealthcenter', // <--- UPDATED TO MATCH YOUR SCREENSHOT
  password: 'samganda',     // ⚠️ REPLACE THIS with your real Postgres password
  port: 5432,
});

// --- ROUTES ---

// 1. Test Route
app.get('/', (req, res) => {
  res.send('Server is connected to database: barangayhealthcenter');
});

// 2. Register New User (Patient)
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Ensure you have a 'users' or 'patients' table created in pgAdmin
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

// 3. Book Appointment (Patient Side)
app.post('/book-appointment', async (req, res) => {
  const { patient_id, appointment_date, reason } = req.body;

  try {
    const query = `
      INSERT INTO appointments (patient_id, appointment_date, reason, status) 
      VALUES ($1, $2, $3, 'Pending') 
      RETURNING *
    `;
    const result = await pool.query(query, [patient_id, appointment_date, reason]);
    console.log("New Appointment:", result.rows[0]);
    res.json({ success: true, appointment: result.rows[0] });

  } catch (err) {
    console.error("Booking Error:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// 4. Get My Appointments (Patient History)
app.get('/my-appointments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM appointments ORDER BY appointment_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 5. Get ALL Appointments (Admin Dashboard)
app.get('/admin/appointments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM appointments ORDER BY appointment_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Admin Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 6. Update Status (Admin Approve/Decline)
app.post('/admin/update-appointment', async (req, res) => {
  const { id, status } = req.body; 
  try {
    const result = await pool.query(
      'UPDATE appointments SET status = $1 WHERE appointment_id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    console.log(`Appointment ${id} updated to ${status}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).send("Server Error");
  }
});
// ... existing routes ...

// 7. Cancel Appointment (Patient Action)
app.post('/cancel-appointment', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query(
      "UPDATE appointments SET status = 'Cancelled' WHERE appointment_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    res.json({ success: true, message: "Appointment cancelled", data: result.rows[0] });
  } catch (err) {
    console.error("Cancellation Error:", err.message);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// ... existing routes ...

// 8. Get User Profile (to load name and photo)
app.get('/get-user-profile', async (req, res) => {
  const userId = 1; // ⚠️ Hardcoded for now. Later this comes from the login session.
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = result.rows[0];
    
    // Send back the user data (including the profile_picture path)
    res.json({ 
      success: true, 
      user: {
        name: user.name || user.first_name + ' ' + user.last_name, // Adjust based on your column names
        email: user.email,
        phone: user.phone || user.contact_number, // Adjust based on your column names
        profile_picture: user.profile_picture // This is the file path!
      }
    });

  } catch (err) {
    console.error("Profile Fetch Error:", err.message);
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

// ... existing routes ...

// 9. Update User Text Details (FIXED: Uses 'name' instead of first_name/last_name)
app.post('/update-user-details', async (req, res) => {
  const { userId, firstName, lastName, phone, address } = req.body;

  // Combine them because your DB only has 'name'
  const fullName = `${firstName} ${lastName}`; 

  try {
    const query = `
      UPDATE users 
      SET name = $1, phone = $2, address = $3 
      WHERE user_id = $4 
      RETURNING *
    `;
    
    // We pass fullName instead of firstName/lastName
    const values = [fullName, phone, address, userId];
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
// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});