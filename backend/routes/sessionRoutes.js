const express = require('express');
const { create, getOne, getSnapshotHandler } = require('../controllers/sessionController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.post('/', requireAuth, create);
router.get('/:sessionId', requireAuth, getOne);
router.get('/:sessionId/snapshot', requireAuth, getSnapshotHandler);

module.exports = router;
