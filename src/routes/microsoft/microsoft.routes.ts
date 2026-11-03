import { Router } from "express";
import { GraphWebhookController } from "../../application/controllers/Microsoft/GraphWebhookController";
import { EmailEventsController } from "../../application/controllers/Microsoft/EmailEventsController";
import { personalOrJwtAuthMiddleware, personalSessionMiddleware } from "../../middlewares/personalOrJwtAuthMiddleware";
import { PersonalAccountController } from "../../application/controllers/Microsoft/PersonalAccountController";
import { GraphMessageController } from "../../application/controllers/Microsoft/GraphMessageController";
import { GraphAttachmentController } from "../../application/controllers/Microsoft/GraphAttachmentController";

export const microsoftRoutes = Router();
microsoftRoutes.post("/webhook", GraphWebhookController.handle(false));
microsoftRoutes.post("/lifecycle", GraphWebhookController.handle(true));
microsoftRoutes.post("/connect", PersonalAccountController.start);
microsoftRoutes.get("/connect", PersonalAccountController.page);
microsoftRoutes.get("/oauth/callback", PersonalAccountController.callback);
microsoftRoutes.get("/events", personalOrJwtAuthMiddleware, EmailEventsController.handle);
microsoftRoutes.get("/messages/:messageId", personalSessionMiddleware, GraphMessageController.handle);
microsoftRoutes.get("/messages/:messageId/attachments", personalSessionMiddleware, GraphAttachmentController.list);
microsoftRoutes.get("/messages/:messageId/attachments/:attachmentId/content", personalSessionMiddleware, GraphAttachmentController.content);
