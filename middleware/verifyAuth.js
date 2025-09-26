import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export function verifyAuth(req, res, next) {
  try {
    const token =
      req.cookies?.sb_access_token || 
      (req.headers.authorization?.split(" ")[1] ?? null); 

    if (!token) {
      return res.status(401).json({ error: "Missing access token" });
    }
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, {
      algorithms: ["HS256"],
    });
    req.user = {
      id: decoded.sub,       
      email: decoded.email,  
      role: decoded.role,    
      ...decoded,            
    };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
