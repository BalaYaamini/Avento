const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  pdfUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'problem_statement_documents' });

module.exports = mongoose.models.ProblemStatementDocument ||
  mongoose.model('ProblemStatementDocument', schema);
