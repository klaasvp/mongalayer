import z from "zod";
import { filterSchema } from "../query.js";

// TODO :: Remove $where / $near / $nearSphere / $text (or allow it only as the first stage)
export const matchSchema = filterSchema;

export const skipSchema = z.int().nonnegative();
export const limitSchema = z.int().positive();