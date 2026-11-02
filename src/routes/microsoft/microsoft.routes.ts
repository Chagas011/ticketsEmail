import { Router } from "express";
import { GraphWebhookController } from "../../application/controllers/Microsoft/GraphWebhookController";
import { EmailEventsController } from "../../application/controllers/Microsoft/EmailEventsController";
import { personalOrJwtAuthMiddleware } from "../../middlewares/personalOrJwtAuthMiddleware";
import { PersonalAccountController } from "../../application/controllers/Microsoft/PersonalAccountController";

export const microsoftRoutes = Router();
microsoftRoutes.post("/webhook", GraphWebhookController.handle(false));
microsoftRoutes.post("/lifecycle", GraphWebhookController.handle(true));
microsoftRoutes.post("/connect", PersonalAccountController.start);
microsoftRoutes.get("/connect", PersonalAccountController.page);
microsoftRoutes.get("/oauth/callback", PersonalAccountController.callback);
microsoftRoutes.get("/events", personalOrJwtAuthMiddleware, EmailEventsController.handle);
