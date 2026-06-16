import express from 'express';
import {
    getAllVouchers,
    getVoucherById,
    getActiveVouchers,  
    createVoucher,
    updateVoucher,
} from '../controllers/VoucherCtrl.js';
import { verifyRole, verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('', verifyToken, verifyRole("ADMIN", "USER"), getAllVouchers);
router.get('/active', verifyToken, verifyRole("ADMIN", "USER"), getActiveVouchers);
router.get('/:id', verifyToken, verifyRole("ADMIN"), getVoucherById);
router.post('/create', verifyToken, verifyRole("ADMIN"), createVoucher);
router.put('/update/:id', verifyToken, verifyRole("ADMIN"), updateVoucher);

export default router;