const leadsService = require("../services/leads.service");

/**
 * Get all leads
 * GET /api/leads
 */
const getLeads = async (req, res, next) => {
  try {
    const filters = {
      platform: req.query.platform,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      search: req.query.search,
    };

    const options = {
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await leadsService.getLeads(filters, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get lead by ID
 * GET /api/leads/:id
 */
const getLeadById = async (req, res, next) => {
  try {
    const lead = await leadsService.getLeadById(req.params.id);
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * Update lead
 * PATCH /api/leads/:id
 */
const updateLead = async (req, res, next) => {
  try {
    const lead = await leadsService.updateLead(req.params.id, req.body);
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete lead
 * DELETE /api/leads/:id
 */
const deleteLead = async (req, res, next) => {
  try {
    await leadsService.deleteLead(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Get lead statistics
 * GET /api/leads/stats
 */
const getLeadStats = async (req, res, next) => {
  try {
    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    };
    const stats = await leadsService.getLeadStats(filters);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get leads by date for charts
 * GET /api/leads/chart
 */
const getLeadsByDate = async (req, res, next) => {
  try {
    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      platform: req.query.platform,
    };
    const data = await leadsService.getLeadsByDate(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,
  getLeadsByDate,
};
