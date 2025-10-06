import express from "express";
import supabase from "../config/supabase.js";
import {verifyAuth }from "../middleware/verifyAuth.js";
import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";

const router = express.Router();

// GET /api/leave-balances
router.get("/leave-balances", verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { data: userRow, error: userErr } = await supabase
      .from("app_user")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (userErr || !userRow) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const orgId = userRow.organization_id;
    const isAdmin = await verifyAdminForOrg(userId, orgId);

    let query = supabase
      .from("leave_balance")
      .select(
        `
        leave_balance_id,
        employee_id,
        leave_type_id,
        year,
        total_allocated,
        total_used,
        remaining
      `
      )
      .order("year", { ascending: false });

    if (!isAdmin) {
      query = query.eq("employee_id", userId);
    } else {
      query = query.in(
        "employee_id",
        (
          await supabase
            .from("app_user")
            .select("id")
            .eq("organization_id", orgId)
        ).data.map((u) => u.id)
      );
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("leave-balances error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;