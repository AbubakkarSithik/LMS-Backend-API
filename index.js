import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import onboardRoutes from "./routes/onboard.js";
import inviteRoutes from "./routes/inviteUser.js"
import appUsersRoutes from "./routes/appUsers.js"
import orgRoutes from "./routes/orgRoutes.js";
import leaveRoutes from "./routes/leave.js"
import employeeRelationsRoutes from "./routes/employeeRelations.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", 
    credentials: true,
  })
);
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/onboard", onboardRoutes);
app.use("/invite", inviteRoutes);
app.use("/users", appUsersRoutes);
app.use("/organization", orgRoutes);
app.use("/leave", leaveRoutes);
app.use("/employee", employeeRelationsRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Supabase Express API is running 🚀");
});

// Start server
const PORT = process.env.PORT || 4005;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});