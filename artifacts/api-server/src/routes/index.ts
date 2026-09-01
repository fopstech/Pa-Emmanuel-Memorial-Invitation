import { Router, type IRouter } from "express";
import healthRouter from "./health";
import memorialRouter from "./memorial";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(memorialRouter);
router.use(storageRouter);

export default router;
