import { Router } from "express";
import { GraphWebhookController } from "../../application/controllers/Microsoft/GraphWebhookController";
import { EmailEventsController } from "../../application/controllers/Microsoft/EmailEventsController";
import { authMiddleware } from "../../middlewares/authMiddleware";

export const microsoftRoutes = Router();
microsoftRoutes.post("/webhook", GraphWebhookController.handle(false));
microsoftRoutes.post("/lifecycle", GraphWebhookController.handle(true));
microsoftRoutes.get("/events", authMiddleware, EmailEventsController.handle);
