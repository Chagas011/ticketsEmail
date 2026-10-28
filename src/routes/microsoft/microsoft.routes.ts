import { Router } from "express";
import { GraphWebhookController } from "../../application/controllers/Microsoft/GraphWebhookController";
import { EmailEventsController } from "../../application/controllers/Microsoft/EmailEventsController";

export const microsoftRoutes = Router();
microsoftRoutes.post("/webhook", GraphWebhookController.handle(false));
microsoftRoutes.post("/lifecycle", GraphWebhookController.handle(true));
microsoftRoutes.get("/events", EmailEventsController.handle);
