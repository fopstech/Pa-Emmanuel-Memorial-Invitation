import { Router, type IRouter } from "express";
import { clearStaffSession, setStaffSession, staffCodeRole, staffRole } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/staff/login", (req, res) => {
  const role = staffCodeRole(String(req.body?.code ?? "").trim());
  if (!role) {
    res.status(401).json({ error: "Invalid staff code" });
    return;
  }
  setStaffSession(res, role);
  res.json({ role });
});

router.post("/staff/logout", (_req, res) => {
  clearStaffSession(res);
  res.sendStatus(204);
});

router.get("/staff/session", (req, res) => {
  const role = staffRole(req);
  if (!role) {
    res.status(401).json({ error: "Staff access required" });
    return;
  }
  res.json({ role });
});

export default router;
