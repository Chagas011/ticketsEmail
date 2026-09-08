import { Router } from "express";

import { accountRoutes } from "./account/account.routes";
const routes = Router();

routes.use("/account", accountRoutes);
export { routes };
