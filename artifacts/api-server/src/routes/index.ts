import { Router, type IRouter } from "express";
import healthRouter from "./health";
import memorialRouter from "./memorial";
import storageRouter from "./storage";
import staffRouter from "./staff";

const router: IRouter = Router();

router.use(healthRouter);
router.use(memorialRouter);
router.use(storageRouter);
router.use(staffRouter);

export default router;
