import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("dispatch opted-in public audits", { hours: 1 }, internal.scheduling.dispatch, {});
export default crons;
