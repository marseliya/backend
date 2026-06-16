import express from "express";

import {
    regis,
    login
} from "../controllers/AuthCtrl.js";


const router = express.Router();

router.post("/regis", regis);
router.post("/login", login);

export default router;