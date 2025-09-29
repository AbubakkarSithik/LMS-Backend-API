import express from "express";
import supabase from "../config/supabase.js";
import { verifyAuth } from "../middleware/verifyAuth.js";
import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";

const router = express.Router();

// GET /api/organization -> get organization details for logged in user
router.get("/org", verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    // find org_id for this user
    const { data: userRow, error: userErr } = await supabase
      .from("app_user")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (userErr || !userRow) {
      return res.status(404).json({ error: "Organization not found for user" });
    }

    const { data: org, error: orgErr } = await supabase
      .from("organization")
      .select("*")
      .eq("organization_id", userRow.organization_id)
      .single();

    if (orgErr) return res.status(500).json({ error: orgErr.message });

    res.json(org);
  } catch (err) {
    console.error("organization error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/leave-types -> visible to all users in org
router.get("/leave-types", verifyAuth, async (req, res) => {
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

    const { data, error } = await supabase
      .from("leave_type")
      .select("*")
      .eq("organization_id", userRow.organization_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("leave-types error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/leave-types -> Admin only
router.post("/leave-types", verifyAuth, async (req, res) => {
  const userId = req.user?.id;
  const { name, description, max_days_per_year } = req.body;

  try {
    const { data: userRow } = await supabase
      .from("app_user")
      .select("organization_id")
      .eq("id", userId)
      .single();

    const orgId = userRow.organization_id;
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabase
      .from("leave_type")
      .insert([{ organization_id: orgId, name, description, max_days_per_year }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("leave-types post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/leave-types/:id -> Admin only
router.put("/leave-types/:id", verifyAuth, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { name, description, max_days_per_year } = req.body;

  try {
    const { data: ltRow } = await supabase
      .from("leave_type")
      .select("organization_id")
      .eq("leave_type_id", id)
      .single();

    if (!ltRow) return res.status(404).json({ error: "Leave type not found" });

    const isAdmin = await verifyAdminForOrg(userId, ltRow.organization_id);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabase
      .from("leave_type")
      .update({ name, description, max_days_per_year })
      .eq("leave_type_id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("leave-types put error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/leave-types/:id -> Admin only
router.delete("/leave-types/:id", verifyAuth, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  try {
    const { data: ltRow } = await supabase
      .from("leave_type")
      .select("organization_id")
      .eq("leave_type_id", id)
      .single();

    if (!ltRow) return res.status(404).json({ error: "Leave type not found" });

    const isAdmin = await verifyAdminForOrg(userId, ltRow.organization_id);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { error } = await supabase
      .from("leave_type")
      .delete()
      .eq("leave_type_id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Leave type deleted" });
  } catch (err) {
    console.error("leave-types delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// GET /api/holidays -> visible to all users in org
router.get("/holidays", verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data: userRow } = await supabase
      .from("app_user")
      .select("organization_id")
      .eq("id", userId)
      .single();

    const orgId = userRow.organization_id;

    const { data, error } = await supabase
      .from("holiday")
      .select("*")
      .eq("organization_id", orgId);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("holidays error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/holidays -> Admin only
router.post("/holidays", verifyAuth, async (req, res) => {
  const userId = req.user?.id;
  const { holiday_date, name, is_recurring } = req.body;

  try {
    const { data: userRow } = await supabase
      .from("app_user")
      .select("organization_id")
      .eq("id", userId)
      .single();

    const orgId = userRow.organization_id;
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabase
      .from("holiday")
      .insert([{ organization_id: orgId, holiday_date, name, is_recurring }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("holiday post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/holidays/:id -> Admin only
router.put("/holidays/:id", verifyAuth, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { holiday_date, name, is_recurring } = req.body;

  try {
    const { data: hRow } = await supabase
      .from("holiday")
      .select("organization_id")
      .eq("holiday_id", id)
      .single();

    if (!hRow) return res.status(404).json({ error: "Holiday not found" });

    const isAdmin = await verifyAdminForOrg(userId, hRow.organization_id);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabase
      .from("holiday")
      .update({ holiday_date, name, is_recurring })
      .eq("holiday_id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("holiday put error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/holidays/:id -> Admin only
router.delete("/holidays/:id", verifyAuth, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  try {
    const { data: hRow } = await supabase
      .from("holiday")
      .select("organization_id")
      .eq("holiday_id", id)
      .single();

    if (!hRow) return res.status(404).json({ error: "Holiday not found" });

    const isAdmin = await verifyAdminForOrg(userId, hRow.organization_id);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { error } = await supabase
      .from("holiday")
      .delete()
      .eq("holiday_id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Holiday deleted" });
  } catch (err) {
    console.error("holiday delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;