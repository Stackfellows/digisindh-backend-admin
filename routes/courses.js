const express = require("express");
const multer = require("multer");
const path = require("path");
const { getCourses, addCourse, deleteCourse } = require("../controllers/courseController");

const router = express.Router();

// Multer configuration for course images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/courses/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "course-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.get("/", getCourses);
router.post("/", upload.single("image"), addCourse);
router.delete("/:id", deleteCourse);

module.exports = router;
