const express = require('express');
const { create, list, getOne, getSnapshotHandler, remove } = require('../controllers/sessionController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, list);
router.post('/', requireAuth, create);
router.get('/:sessionId', requireAuth, getOne);
router.get('/:sessionId/snapshot', requireAuth, getSnapshotHandler);
router.delete('/:sessionId', requireAuth, remove);

module.exports = router;
