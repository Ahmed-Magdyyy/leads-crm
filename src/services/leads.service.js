const mongoose = require("mongoose");
const Lead = require("../models/Lead");

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Create standardized error with status code
 */
const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return str.trim().slice(0, 1000); // Limit string length
};

/**
 * Get all leads with filters
 */
const getLeads = async (filters = {}, options = {}) => {
  const query = {};

  // Platform filter
  if (filters.platform) {
    query.platform = filters.platform;
  }

  // Status filter
  if (filters.status) {
    query.status = filters.status;
  }

  // Date range filter
  if (filters.fromDate || filters.toDate) {
    query.receivedAt = {};
    if (filters.fromDate) {
      query.receivedAt.$gte = new Date(filters.fromDate);
    }
    if (filters.toDate) {
      query.receivedAt.$lte = new Date(filters.toDate);
    }
  }

  // Search filter
  if (filters.search) {
    query.$or = [
      { customerName: { $regex: filters.search, $options: "i" } },
      { email: { $regex: filters.search, $options: "i" } },
      { phone: { $regex: filters.search, $options: "i" } },
    ];
  }

  // Pagination
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 20;
  const skip = (page - 1) * limit;

  // Sorting
  const sortField = options.sortBy || "receivedAt";
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  const sort = { [sortField]: sortOrder };

  const [leads, total] = await Promise.all([
    Lead.find(query).sort(sort).skip(skip).limit(limit),
    Lead.countDocuments(query),
  ]);

  return {
    leads,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get lead by ID
 */
const getLeadById = async (id) => {
  if (!id || !isValidObjectId(id)) {
    throw createError("Invalid lead ID format", 400);
  }

  const lead = await Lead.findById(id);
  if (!lead) {
    throw createError("Lead not found", 404);
  }
  return lead;
};

/**
 * Update lead
 */
const updateLead = async (id, updateData) => {
  if (!id || !isValidObjectId(id)) {
    throw createError("Invalid lead ID format", 400);
  }

  if (!updateData || typeof updateData !== "object") {
    throw createError("Update data is required", 400);
  }

  // Only allow updating certain fields
  const allowedFields = ["status", "notes", "customerName", "email", "phone"];
  const validStatuses = ["new", "contacted", "qualified", "converted", "lost"];
  const filteredData = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      // Validate status field
      if (field === "status" && !validStatuses.includes(updateData[field])) {
        throw createError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          400,
        );
      }

      // Validate email format
      if (field === "email" && updateData[field]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData[field])) {
          throw createError("Invalid email format", 400);
        }
      }

      filteredData[field] = sanitizeString(updateData[field]);
    }
  }

  if (Object.keys(filteredData).length === 0) {
    throw createError("No valid fields to update", 400);
  }

  const lead = await Lead.findByIdAndUpdate(id, filteredData, {
    new: true,
    runValidators: true,
  });

  if (!lead) {
    throw createError("Lead not found", 404);
  }

  return lead;
};

/**
 * Delete lead
 */
const deleteLead = async (id) => {
  if (!id || !isValidObjectId(id)) {
    throw createError("Invalid lead ID format", 400);
  }

  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) {
    throw createError("Lead not found", 404);
  }
  return lead;
};

/**
 * Get lead statistics
 */
const getLeadStats = async (filters = {}) => {
  const matchStage = {};

  // Date range filter
  if (filters.fromDate || filters.toDate) {
    matchStage.receivedAt = {};
    if (filters.fromDate) {
      matchStage.receivedAt.$gte = new Date(filters.fromDate);
    }
    if (filters.toDate) {
      matchStage.receivedAt.$lte = new Date(filters.toDate);
    }
  }

  const [platformStats, statusStats, totalLeads, todayLeads] =
    await Promise.all([
      // Leads by platform
      Lead.aggregate([
        { $match: matchStage },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
      ]),

      // Leads by status
      Lead.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Total leads
      Lead.countDocuments(matchStage),

      // Today's leads
      Lead.countDocuments({
        ...matchStage,
        receivedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
    ]);

  // Format platform stats
  const byPlatform = {
    meta: 0,
    snapchat: 0,
    tiktok: 0,
  };
  platformStats.forEach((stat) => {
    byPlatform[stat._id] = stat.count;
  });

  // Format status stats
  const byStatus = {
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    lost: 0,
  };
  statusStats.forEach((stat) => {
    byStatus[stat._id] = stat.count;
  });

  return {
    total: totalLeads,
    today: todayLeads,
    byPlatform,
    byStatus,
  };
};

/**
 * Get leads grouped by date for charts
 */
const getLeadsByDate = async (filters = {}) => {
  const matchStage = {};

  // Default to last 30 days
  const fromDate = filters.fromDate
    ? new Date(filters.fromDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = filters.toDate ? new Date(filters.toDate) : new Date();

  matchStage.receivedAt = {
    $gte: fromDate,
    $lte: toDate,
  };

  if (filters.platform) {
    matchStage.platform = filters.platform;
  }

  const results = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$receivedAt" } },
          platform: "$platform",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  return results.map((r) => ({
    date: r._id.date,
    platform: r._id.platform,
    count: r.count,
  }));
};

module.exports = {
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,
  getLeadsByDate,
};
