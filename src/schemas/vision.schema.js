const { z } = require('zod');

/**
 * Zod Schema for Structured Vision AI Classification Output
 */
const ImageMetadataSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject is required and cannot be empty')
    .transform((s) => s.trim().toLowerCase()),
  category: z
    .string()
    .min(1, 'Category is required and cannot be empty')
    .transform((c) => c.trim().toLowerCase()),
  attributes: z
    .array(z.string().min(1))
    .min(1, 'At least one visual attribute is required'),
  caption: z
    .string()
    .min(5, 'Caption must be at least 5 characters'),
  confidence: z
    .number()
    .min(0.0, 'Confidence must be >= 0.0')
    .max(1.0, 'Confidence must be <= 1.0')
});

module.exports = {
  ImageMetadataSchema
};
