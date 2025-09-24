import express from "express";
import dotenv from "dotenv";
dotenv.config();
import authRoutes from "./routes/auth.js";
import appUserRoutes from "./routes/appUser.js";


const app = express();
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", appUserRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Supabase Express API is running 🚀");
});

// Start server
const PORT = process.env.PORT || 4005;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});