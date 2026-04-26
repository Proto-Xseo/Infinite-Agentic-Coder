import { Router, type IRouter } from "express";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import sandboxRouter from "./sandbox";

const router: IRouter = Router();

router.use(conversationsRouter);
router.use(messagesRouter);
router.use(sandboxRouter);

export default router;
