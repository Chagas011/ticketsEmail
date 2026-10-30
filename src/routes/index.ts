import { Router } from "express";


import { microsoftRoutes } from "./microsoft/microsoft.routes";
const routes = Router();

routes.use("/microsoft", microsoftRoutes);
export { routes };
