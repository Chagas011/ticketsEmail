import { Router } from "express";
import { expressRouteAdapter } from "../../adapter/expressRouteAdapter";
import { GraphLifecycleController, GraphWebhookController } from "../../application/controllers/Microsoft/GraphWebhookController";
import { EmailEventsController } from "../../application/controllers/Microsoft/EmailEventsController";
import { GraphMessageController } from "../../application/controllers/Microsoft/GraphMessageController";
import { GraphConversationController } from "../../application/controllers/Microsoft/GraphConversationController";
import { GraphAttachmentController } from "../../application/controllers/Microsoft/GraphAttachmentController";
import { GraphAttachmentContentController } from "../../application/controllers/Microsoft/GraphAttachmentContentController";
import { GraphReplyController } from "../../application/controllers/Microsoft/GraphReplyController";

export const microsoftRoutes = Router();
microsoftRoutes.post("/webhook", expressRouteAdapter(GraphWebhookController));
microsoftRoutes.post("/lifecycle", expressRouteAdapter(GraphLifecycleController));
microsoftRoutes.get("/events", expressRouteAdapter(EmailEventsController));
microsoftRoutes.get("/conversations/:conversationId/messages", expressRouteAdapter(GraphConversationController));
microsoftRoutes.get("/messages/:messageId", expressRouteAdapter(GraphMessageController));
microsoftRoutes.post("/messages/:messageId/reply", expressRouteAdapter(GraphReplyController));
microsoftRoutes.get("/messages/:messageId/attachments", expressRouteAdapter(GraphAttachmentController));
microsoftRoutes.get("/messages/:messageId/attachments/:attachmentId/content", expressRouteAdapter(GraphAttachmentContentController));
