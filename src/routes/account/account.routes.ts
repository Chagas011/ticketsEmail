import { expressRouteAdapter } from "@/adapter/expressRouteAdapter";
import { AccountController } from "@/application/controllers/Account/AccountController";
import { Router } from "express";

export const accountRoutes = Router();

accountRoutes.get("/", expressRouteAdapter(AccountController));

// utilizando middleware
//homeRoutes.get("/", authMiddleware, expressRouteAdapter(GetController));
