const express = require("express");
const router = express.Router();
const leadsController = require("../controllers/leads.controller");

// GET /api/leads/stats - Get lead statistics (must be before /:id route)
router.get("/stats", leadsController.getLeadStats);

// GET /api/leads/chart - Get leads by date for charts
router.get("/chart", leadsController.getLeadsByDate);

// GET /api/leads - Get all leads with filters
router.get("/", leadsController.getLeads);

// GET /api/leads/:id - Get single lead
router.get("/:id", leadsController.getLeadById);

// PATCH /api/leads/:id - Update lead
router.patch("/:id", leadsController.updateLead);

// DELETE /api/leads/:id - Delete lead
router.delete("/:id", leadsController.deleteLead);

module.exports = router;
