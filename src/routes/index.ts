import { Router } from "express";

import { accountRoutes } from "./account/account.routes";
import { microsoftRoutes } from "./microsoft/microsoft.routes";
const routes = Router();

routes.use("/account", accountRoutes);
routes.use("/microsoft", microsoftRoutes);
export { routes };
