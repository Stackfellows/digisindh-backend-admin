const Course = require("../models/Course");

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Add a new course
// @route   POST /api/courses
// @access  Admin
exports.addCourse = async (req, res) => {
  try {
    const { name, price, description } = req.body;
    
    let image = "";
    if (req.file) {
      // Use the relative path for the image
      image = req.file.path.replace(/\\/g, '/');
    }

    if (!name || !image) {
        return res.status(400).json({
            success: false,
            message: "Please provide course name and image"
        });
    }

    const course = await Course.create({
      name,
      image,
      price: price || 1000,
      description: description || "",
    });

    res.status(201).json({
      success: true,
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Delete a course
// @route   DELETE /api/courses/:id
// @access  Admin
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    await course.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
