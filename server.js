const {create} = require("express-handlebars");
const express = require("express");
const path = require("path");
const connectDB = require("./config/db");
const Student = require("./model/students");
const Teacher = require("./model/teachers");
const SchoolClass = require("./model/classes");
const Announcement = require("./model/announcements");

const app =  express();

app.use(express.urlencoded({ extended: true }));

const gradeOptions = ["6", "7", "8", "9", "10"];

const subjectOptions = ["Mathematics", "Biology", "History", "English", "Chemistry", "Physics", "Computer Science"];

const announcementTypes = ["Notice", "Event", "Campaign", "Reminder"];
const announcementAudiences = ["All", "Teachers", "Students", "Parents", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grades 7-10"];

const hbs = create({
    layoutsDir: path.join(__dirname, "views", "layouts")
});
app.engine("handlebars", hbs.engine);

app.set("view engine", "handlebars");

app.set("views", path.join(__dirname, "views"));

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("Database connection error:", error.message);
        res.status(500).send("Unable to connect to database.");
    }
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.get("/", async (req, res) => {
    try {
        const dashboardStudents = await Student.find()
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();
        const dashboardTeachers = await Teacher.find()
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();
        const dashboardClasses = await SchoolClass.find()
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();
        const dashboardAnnouncements = await Announcement.find()
            .sort({ date: -1 })
            .limit(3)
            .lean();

        const studentCount = await Student.countDocuments();
        const teacherCount = await Teacher.countDocuments();
        const classCount = await SchoolClass.countDocuments();

        const dashboard = {
            title: "School Management Sysetm",
            date: "February 28, 2026",
            stats: [
                { label: "Students", value: `${studentCount}`, note: "Live from database" },
                { label: "Teachers", value: `${teacherCount}`, note: "Live from database" },
                { label: "Classes", value: `${classCount}`, note: "Live from database" },
                { label: "Fee Collection", value: "$48,750", note: "89% received" }
            ],
            announcements: dashboardAnnouncements.map((announcement) => ({
                title: announcement.title,
                message: announcement.message,
                type: announcement.type
            })),
            students: dashboardStudents.map((student) => ({
                roll: student.roll,
                name: student.name,
                class: student.class || student.grade,
                attendance: `${student.attendance}%`
            })),
            teachers: dashboardTeachers.map((teacher) => ({
                name: teacher.name,
                subject: teacher.subject,
                classes: teacher.classes
            })),
            classes: dashboardClasses.map((classItem) => ({
                className: classItem.className,
                room: classItem.room,
                classTeacher: classItem.classTeacher,
                capacity: `${classItem.enrolled}/${classItem.capacity}`
            }))
        };

        res.render("home", dashboard);
    } catch (error) {
        console.error("Failed to load dashboard:", error.message);
        res.status(500).send("Unable to load dashboard.");
    }
});

async function renderStudentsPage(req, res, message = "", formInput = null) {
    const search = (req.query.search || "").trim();
    const className = (req.query.class || req.query.grade || "all").trim();
    const attendanceSort = (req.query.attendanceSort || "default").trim();
    const editId = (req.query.editId || "").trim();

    try {
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: escapeRegex(search), $options: "i" } },
                { roll: { $regex: escapeRegex(search), $options: "i" } },
                { phone: { $regex: escapeRegex(search), $options: "i" } }
            ];
        }

        if (className !== "all") {
            query.$or = [...(query.$or || []), { class: className }, { grade: className }];
        }

        const sort = {};

        if (attendanceSort === "asc") {
            sort.attendance = 1;
        }

        if (attendanceSort === "desc") {
            sort.attendance = -1;
        }

        const studentDocs = await Student.find(query).sort(sort).lean();
        const students = studentDocs.map((student) => ({
            ...student,
            id: student._id.toString(),
            class: student.class || student.grade,
            attendanceLabel: `${student.attendance}%`
        }));

        let editingStudent = null;
        if (editId) {
            const editingStudentDoc = await Student.findById(editId).lean();
            if (editingStudentDoc) {
                editingStudent = {
                    ...editingStudentDoc,
                    id: editingStudentDoc._id.toString()
                };
            }
        }

        const totalStudents = await Student.countDocuments();
        const attendanceStats = await Student.aggregate([
            {
                $group: {
                    _id: null,
                    averageAttendance: { $avg: "$attendance" },
                    highAttendance: {
                        $sum: {
                            $cond: [{ $gte: ["$attendance", 95] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const averageAttendance = attendanceStats.length
            ? `${Math.round(attendanceStats[0].averageAttendance)}%`
            : "0%";
        const highAttendance = attendanceStats.length ? attendanceStats[0].highAttendance : 0;

        const viewData = {
            title: "Student Management",
            subtitle: "Manage enrollment, attendance, and student records",
            totalStudents,
            averageAttendance,
            highAttendance,
            students,
            gradeOptions: gradeOptions.map((value) => ({
                value,
                selected: value === className
            })),
            filters: {
                search,
                class: className,
                attendanceSort,
                attendanceAscSelected: attendanceSort === "asc",
                attendanceDescSelected: attendanceSort === "desc",
                attendanceDefaultSelected: attendanceSort === "default"
            },
            message,
            hasMessage: Boolean(message),
            editingStudent,
            form: formInput || editingStudent || { roll: "", name: "", class: "6", attendance: "", phone: "" },
            isEditing: Boolean(editingStudent)
        };

        res.render("students", viewData);
    } catch (error) {
        console.error("Failed to load students page:", error.message);
        res.status(500).send("Unable to load students page.");
    }
}

app.get("/students", async (req, res) => {
    await renderStudentsPage(req, res);
});

app.post("/students/add", async (req, res) => {
    const roll = (req.body.roll || "").trim();
    const name = (req.body.name || "").trim();
    const classNameInput = req.body.class ?? req.body.grade ?? "6";
    const className = `${classNameInput}`.trim() || "6";
    const phone = (req.body.phone || "").trim();
    const formInput = { roll, name, class: className, phone };

    if (!roll || !name || !phone) {
        return renderStudentsPage(req, res, "Please complete all student fields.", formInput);
    }

    try {
        const rollExists = await Student.findOne({
            roll: { $regex: `^${escapeRegex(roll)}$`, $options: "i" }
        });

        if (rollExists) {
            return renderStudentsPage(req, res, "Roll number already exists.", formInput);
        }

        const allocatedClass = await SchoolClass.findOneAndUpdate(
            {
                grade: className,
                $expr: { $lt: ["$enrolled", "$capacity"] }
            },
            {
                $inc: { enrolled: 1 }
            },
            {
                sort: { enrolled: 1 },
                returnDocument: "after"
            }
        );

        if (!allocatedClass) {
            return renderStudentsPage(req, res, `No available seats found in Class ${className}.`, formInput);
        }

        try {
            await Student.create({
                roll,
                name,
                class: className,
                phone,
                attendance: 0
            });
        } catch (createError) {
            await SchoolClass.updateOne(
                { _id: allocatedClass._id, enrolled: { $gt: 0 } },
                { $inc: { enrolled: -1 } }
            );
            throw createError;
        }

        res.redirect("/students");
    } catch (error) {
        console.error("Failed to add student:", error.message);
        return renderStudentsPage(req, res, "Unable to add student right now.", formInput);
    }
});

app.post("/students/update/:id", async (req, res) => {
    const id = req.params.id;

    const roll = (req.body.roll || "").trim();
    const name = (req.body.name || "").trim();
    const classNameInput = req.body.class ?? req.body.grade ?? "6";
    const className = `${classNameInput}`.trim() || "6";
    const phone = (req.body.phone || "").trim();
    const formInput = { id, roll, name, class: className, phone };

    if (!roll || !name || !phone) {
        return renderStudentsPage(req, res, "Please complete all student fields.", formInput);
    }

    try {
        const student = await Student.findById(id);

        if (!student) {
            return renderStudentsPage(req, res, "Student not found for update.");
        }

        const rollExists = await Student.findOne({
            _id: { $ne: id },
            roll: { $regex: `^${escapeRegex(roll)}$`, $options: "i" }
        });

        if (rollExists) {
            return renderStudentsPage(req, res, "Another student already uses this roll number.", formInput);
        }

        student.roll = roll;
        student.name = name;
        student.class = className;
        student.phone = phone;

        await student.save();

        res.redirect("/students");
    } catch (error) {
        console.error("Failed to update student:", error.message);
        return renderStudentsPage(req, res, "Unable to update student right now.", formInput);
    }
});

app.post("/students/delete/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await Student.findByIdAndDelete(id);
    } catch (error) {
        console.error("Failed to delete student:", error.message);
    }

    res.redirect("/students");
});

async function renderTeachersPage(req, res, message = "", formInput = null) {
    const search = (req.query.search || "").trim();
    const subject = (req.query.subject || "all").trim();
    const experienceSort = (req.query.experienceSort || "default").trim();
    const editId = (req.query.editId || "").trim();

    try {
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: escapeRegex(search), $options: "i" } },
                { employeeId: { $regex: escapeRegex(search), $options: "i" } },
                { phone: { $regex: escapeRegex(search), $options: "i" } }
            ];
        }

        if (subject !== "all") {
            query.subject = subject;
        }

        const sort = {};
        if (experienceSort === "asc") {
            sort.experience = 1;
        }
        if (experienceSort === "desc") {
            sort.experience = -1;
        }

        const teacherDocs = await Teacher.find(query).sort(sort).lean();
        const teachers = teacherDocs.map((teacher) => ({
            ...teacher,
            id: teacher._id.toString(),
            experienceLabel: `${teacher.experience} years`
        }));

        let editingTeacher = null;
        if (editId) {
            const editingTeacherDoc = await Teacher.findById(editId).lean();
            if (editingTeacherDoc) {
                editingTeacher = {
                    ...editingTeacherDoc,
                    id: editingTeacherDoc._id.toString()
                };
            }
        }

        const totalTeachers = await Teacher.countDocuments();
        const teacherStats = await Teacher.aggregate([
            {
                $group: {
                    _id: null,
                    totalClassesHandled: { $sum: "$classes" },
                    averageExperience: { $avg: "$experience" },
                    seniorTeachers: {
                        $sum: {
                            $cond: [{ $gte: ["$experience", 8] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const totalClassesHandled = teacherStats.length ? teacherStats[0].totalClassesHandled : 0;
        const averageExperience = teacherStats.length
            ? Math.round((teacherStats[0].averageExperience || 0) * 10) / 10
            : 0;
        const seniorTeachers = teacherStats.length ? teacherStats[0].seniorTeachers : 0;

        const viewData = {
            title: "Teacher Management",
            subtitle: "Manage teacher profiles, workloads, and departments",
            totalTeachers,
            totalClassesHandled,
            averageExperience: `${averageExperience} yrs`,
            seniorTeachers,
            teachers,
            subjectOptions: subjectOptions.map((value) => ({
                value,
                selected: value === subject
            })),
            filters: {
                search,
                subject,
                experienceSort,
                experienceAscSelected: experienceSort === "asc",
                experienceDescSelected: experienceSort === "desc",
                experienceDefaultSelected: experienceSort === "default"
            },
            message,
            hasMessage: Boolean(message),
            form: formInput || editingTeacher || {
                employeeId: "",
                name: "",
                subject: subjectOptions[0],
                classes: "",
                experience: "",
                phone: ""
            },
            isEditing: Boolean(editingTeacher)
        };

        res.render("teachers", viewData);
    } catch (error) {
        console.error("Failed to load teachers page:", error.message);
        res.status(500).send("Unable to load teachers page.");
    }
}

app.get("/teachers", async (req, res) => {
    await renderTeachersPage(req, res);
});

app.post("/teachers/add", async (req, res) => {
    const employeeId = (req.body.employeeId || "").trim();
    const name = (req.body.name || "").trim();
    const subject = (req.body.subject || "").trim();
    const phone = (req.body.phone || "").trim();
    const classes = Number.parseInt(req.body.classes, 10);
    const experience = Number.parseInt(req.body.experience, 10);
    const formInput = {
        employeeId,
        name,
        subject: subject || subjectOptions[0],
        classes: req.body.classes || "",
        experience: req.body.experience || "",
        phone
    };

    if (!employeeId || !name || !subject || !phone || Number.isNaN(classes) || Number.isNaN(experience)) {
        return renderTeachersPage(req, res, "Please complete all teacher fields.", formInput);
    }

    try {
        const idExists = await Teacher.findOne({
            employeeId: { $regex: `^${escapeRegex(employeeId)}$`, $options: "i" }
        });

        if (idExists) {
            return renderTeachersPage(req, res, "Employee ID already exists.", formInput);
        }

        await Teacher.create({
            employeeId,
            name,
            subject,
            phone,
            classes: Math.max(0, classes),
            experience: Math.max(0, experience)
        });

        res.redirect("/teachers");
    } catch (error) {
        console.error("Failed to add teacher:", error.message);
        return renderTeachersPage(req, res, "Unable to add teacher right now.", formInput);
    }
});

app.post("/teachers/update/:id", async (req, res) => {
    const id = req.params.id;

    const employeeId = (req.body.employeeId || "").trim();
    const name = (req.body.name || "").trim();
    const subject = (req.body.subject || "").trim();
    const phone = (req.body.phone || "").trim();
    const classes = Number.parseInt(req.body.classes, 10);
    const experience = Number.parseInt(req.body.experience, 10);
    const formInput = {
        id,
        employeeId,
        name,
        subject: subject || subjectOptions[0],
        classes: req.body.classes || "",
        experience: req.body.experience || "",
        phone
    };

    if (!employeeId || !name || !subject || !phone || Number.isNaN(classes) || Number.isNaN(experience)) {
        return renderTeachersPage(req, res, "Please complete all teacher fields.", formInput);
    }

    try {
        const teacher = await Teacher.findById(id);

        if (!teacher) {
            return renderTeachersPage(req, res, "Teacher not found for update.");
        }

        const idExists = await Teacher.findOne({
            _id: { $ne: id },
            employeeId: { $regex: `^${escapeRegex(employeeId)}$`, $options: "i" }
        });

        if (idExists) {
            return renderTeachersPage(req, res, "Another teacher already uses this employee ID.", formInput);
        }

        teacher.employeeId = employeeId;
        teacher.name = name;
        teacher.subject = subject;
        teacher.phone = phone;
        teacher.classes = Math.max(0, classes);
        teacher.experience = Math.max(0, experience);

        await teacher.save();

        res.redirect("/teachers");
    } catch (error) {
        console.error("Failed to update teacher:", error.message);
        return renderTeachersPage(req, res, "Unable to update teacher right now.", formInput);
    }
});

app.post("/teachers/delete/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await Teacher.findByIdAndDelete(id);
    } catch (error) {
        console.error("Failed to delete teacher:", error.message);
    }

    res.redirect("/teachers");
});

async function renderClassesPage(req, res, message = "", formInput = null) {
    const search = (req.query.search || "").trim();
    const grade = (req.query.grade || "all").trim();
    const occupancySort = (req.query.occupancySort || "default").trim();
    const editId = (req.query.editId || "").trim();

    try {
        const query = {};

        if (search) {
            query.$or = [
                { className: { $regex: escapeRegex(search), $options: "i" } },
                { room: { $regex: escapeRegex(search), $options: "i" } },
                { classTeacher: { $regex: escapeRegex(search), $options: "i" } }
            ];
        }

        if (grade !== "all") {
            query.grade = grade;
        }

        const classDocs = await SchoolClass.find(query).lean();
        const classes = classDocs.map((classItem) => {
            const occupancy = classItem.capacity ? Math.round((classItem.enrolled / classItem.capacity) * 100) : 0;
            return {
                ...classItem,
                id: classItem._id.toString(),
                seatsLabel: `${classItem.enrolled}/${classItem.capacity}`,
                occupancy
            };
        });

        if (occupancySort === "asc") {
            classes.sort((a, b) => a.occupancy - b.occupancy);
        }

        if (occupancySort === "desc") {
            classes.sort((a, b) => b.occupancy - a.occupancy);
        }

        let editingClass = null;
        if (editId) {
            const editingClassDoc = await SchoolClass.findById(editId).lean();
            if (editingClassDoc) {
                editingClass = {
                    ...editingClassDoc,
                    id: editingClassDoc._id.toString()
                };
            }
        }

        const classStats = await SchoolClass.aggregate([
            {
                $group: {
                    _id: null,
                    totalClasses: { $sum: 1 },
                    totalCapacity: { $sum: "$capacity" },
                    totalEnrolled: { $sum: "$enrolled" }
                }
            }
        ]);

        const totalClasses = classStats.length ? classStats[0].totalClasses : 0;
        const totalCapacity = classStats.length ? classStats[0].totalCapacity : 0;
        const totalEnrolled = classStats.length ? classStats[0].totalEnrolled : 0;
        const occupancyRate = totalCapacity ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

        const teacherDocs = await Teacher.find().select("name").sort({ name: 1 }).lean();
        const selectedTeacher = (formInput && formInput.classTeacher)
            || (editingClass && editingClass.classTeacher)
            || "";

        const viewData = {
            title: "Class Management",
            subtitle: "Manage rooms, teachers, and class capacities",
            totalClasses,
            totalEnrolled,
            totalCapacity,
            occupancyRate: `${occupancyRate}%`,
            classes,
            gradeOptions: gradeOptions.map((value) => ({
                value,
                selected: value === grade
            })),
            teacherOptions: teacherDocs.map((teacher) => ({
                name: teacher.name,
                selected: teacher.name === selectedTeacher
            })),
            filters: {
                search,
                grade,
                occupancySort,
                occupancyAscSelected: occupancySort === "asc",
                occupancyDescSelected: occupancySort === "desc",
                occupancyDefaultSelected: occupancySort === "default"
            },
            message,
            hasMessage: Boolean(message),
            form: formInput || editingClass || {
                className: "",
                grade: gradeOptions[0],
                room: "",
                classTeacher: "",
                capacity: "",
                enrolled: ""
            },
            isEditing: Boolean(editingClass)
        };

        res.render("classes", viewData);
    } catch (error) {
        console.error("Failed to load classes page:", error.message);
        res.status(500).send("Unable to load classes page.");
    }
}

app.get("/classes", async (req, res) => {
    await renderClassesPage(req, res);
});

app.post("/classes/add", async (req, res) => {
    const className = (req.body.className || "").trim();
    const grade = (req.body.grade || "").trim();
    const room = (req.body.room || "").trim();
    const classTeacher = (req.body.classTeacher || "").trim();
    const capacity = Number.parseInt(req.body.capacity, 10);
    const enrolled = Number.parseInt(req.body.enrolled, 10);
    const formInput = {
        className,
        grade: grade || gradeOptions[0],
        room,
        classTeacher,
        capacity: req.body.capacity || "",
        enrolled: req.body.enrolled || ""
    };

    if (!className || !grade || !room || !classTeacher || Number.isNaN(capacity) || Number.isNaN(enrolled)) {
        return renderClassesPage(req, res, "Please complete all class fields.", formInput);
    }

    try {
        const classExists = await SchoolClass.findOne({
            className: { $regex: `^${escapeRegex(className)}$`, $options: "i" }
        });

        if (classExists) {
            return renderClassesPage(req, res, "Class name already exists.", formInput);
        }

        const safeCapacity = Math.max(1, capacity);
        const safeEnrolled = Math.min(safeCapacity, Math.max(0, enrolled));

        await SchoolClass.create({
            className,
            grade,
            room,
            classTeacher,
            capacity: safeCapacity,
            enrolled: safeEnrolled
        });

        res.redirect("/classes");
    } catch (error) {
        console.error("Failed to add class:", error.message);
        return renderClassesPage(req, res, "Unable to add class right now.", formInput);
    }
});

app.post("/classes/update/:id", async (req, res) => {
    const id = req.params.id;
    const className = (req.body.className || "").trim();
    const grade = (req.body.grade || "").trim();
    const room = (req.body.room || "").trim();
    const classTeacher = (req.body.classTeacher || "").trim();
    const capacity = Number.parseInt(req.body.capacity, 10);
    const enrolled = Number.parseInt(req.body.enrolled, 10);
    const formInput = {
        id,
        className,
        grade: grade || gradeOptions[0],
        room,
        classTeacher,
        capacity: req.body.capacity || "",
        enrolled: req.body.enrolled || ""
    };

    if (!className || !grade || !room || !classTeacher || Number.isNaN(capacity) || Number.isNaN(enrolled)) {
        return renderClassesPage(req, res, "Please complete all class fields.", formInput);
    }

    try {
        const classItem = await SchoolClass.findById(id);

        if (!classItem) {
            return renderClassesPage(req, res, "Class not found for update.");
        }

        const classExists = await SchoolClass.findOne({
            _id: { $ne: id },
            className: { $regex: `^${escapeRegex(className)}$`, $options: "i" }
        });

        if (classExists) {
            return renderClassesPage(req, res, "Another class already uses this name.", formInput);
        }

        const safeCapacity = Math.max(1, capacity);
        const safeEnrolled = Math.min(safeCapacity, Math.max(0, enrolled));

        classItem.className = className;
        classItem.grade = grade;
        classItem.room = room;
        classItem.classTeacher = classTeacher;
        classItem.capacity = safeCapacity;
        classItem.enrolled = safeEnrolled;

        await classItem.save();

        res.redirect("/classes");
    } catch (error) {
        console.error("Failed to update class:", error.message);
        return renderClassesPage(req, res, "Unable to update class right now.", formInput);
    }
});

app.post("/classes/delete/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await SchoolClass.findByIdAndDelete(id);
    } catch (error) {
        console.error("Failed to delete class:", error.message);
    }

    res.redirect("/classes");
});

async function renderAnnouncementsPage(req, res, message = "", formInput = null) {
    const search = (req.query.search || "").trim();
    const type = (req.query.type || "all").trim();
    const dateSort = (req.query.dateSort || "default").trim();

    try {
        const query = {};

        if (search) {
            query.$or = [
                { title: { $regex: escapeRegex(search), $options: "i" } },
                { message: { $regex: escapeRegex(search), $options: "i" } },
                { audience: { $regex: escapeRegex(search), $options: "i" } }
            ];
        }

        if (type !== "all") {
            query.type = type;
        }

        const sort = {};
        if (dateSort === "asc") {
            sort.date = 1;
        }
        if (dateSort === "desc") {
            sort.date = -1;
        }

        const announcementDocs = await Announcement.find(query).sort(sort).lean();
        const announcements = announcementDocs.map((announcement) => ({
            ...announcement,
            id: announcement._id.toString()
        }));

        const editId = (req.query.editId || "").trim();
        let editingAnnouncement = null;
        if (editId) {
            const editingAnnouncementDoc = await Announcement.findById(editId).lean();
            if (editingAnnouncementDoc) {
                editingAnnouncement = {
                    ...editingAnnouncementDoc,
                    id: editingAnnouncementDoc._id.toString()
                };
            }
        }

        const totalAnnouncements = await Announcement.countDocuments();
        const eventCount = await Announcement.countDocuments({ type: "Event" });
        const noticeCount = await Announcement.countDocuments({ type: "Notice" });
        const today = new Date().toISOString().slice(0, 10);
        const upcomingCount = await Announcement.countDocuments({ date: { $gte: today } });

        const selectedAudience = (formInput && formInput.audience)
            || (editingAnnouncement && editingAnnouncement.audience)
            || announcementAudiences[0];

        const viewData = {
            title: "Announcement Management",
            subtitle: "Create and manage school notices and events",
            totalAnnouncements,
            eventCount,
            noticeCount,
            upcomingCount,
            announcements,
            announcementTypes: announcementTypes.map((value) => ({
                value,
                selected: value === type
            })),
            announcementAudiences: announcementAudiences.map((value) => ({
                value,
                selected: value === selectedAudience
            })),
            filters: {
                search,
                type,
                dateSort,
                dateAscSelected: dateSort === "asc",
                dateDescSelected: dateSort === "desc",
                dateDefaultSelected: dateSort === "default"
            },
            message,
            hasMessage: Boolean(message),
            form: formInput || editingAnnouncement || {
                title: "",
                message: "",
                type: announcementTypes[0],
                audience: announcementAudiences[0],
                date: ""
            },
            isEditing: Boolean(editingAnnouncement)
        };

        res.render("announcements", viewData);
    } catch (error) {
        console.error("Failed to load announcements page:", error.message);
        res.status(500).send("Unable to load announcements page.");
    }
}

app.get("/announcements", async (req, res) => {
    await renderAnnouncementsPage(req, res);
});

app.post("/announcements/add", async (req, res) => {
    const title = (req.body.title || "").trim();
    const announcementMessage = (req.body.message || "").trim();
    const type = (req.body.type || "").trim();
    const audience = (req.body.audience || "").trim();
    const date = (req.body.date || "").trim();
    const formInput = {
        title,
        message: announcementMessage,
        type: type || announcementTypes[0],
        audience: audience || announcementAudiences[0],
        date
    };

    if (!title || !announcementMessage || !type || !audience || !date) {
        return renderAnnouncementsPage(req, res, "Please complete all announcement fields.", formInput);
    }

    try {
        const titleExists = await Announcement.findOne({
            title: { $regex: `^${escapeRegex(title)}$`, $options: "i" }
        });

        if (titleExists) {
            return renderAnnouncementsPage(req, res, "Announcement title already exists.", formInput);
        }

        await Announcement.create({
            title,
            message: announcementMessage,
            type,
            audience,
            date
        });

        res.redirect("/announcements");
    } catch (error) {
        console.error("Failed to add announcement:", error.message);
        return renderAnnouncementsPage(req, res, "Unable to add announcement right now.", formInput);
    }
});

app.post("/announcements/update/:id", async (req, res) => {
    const id = req.params.id;

    const title = (req.body.title || "").trim();
    const announcementMessage = (req.body.message || "").trim();
    const type = (req.body.type || "").trim();
    const audience = (req.body.audience || "").trim();
    const date = (req.body.date || "").trim();
    const formInput = {
        id,
        title,
        message: announcementMessage,
        type: type || announcementTypes[0],
        audience: audience || announcementAudiences[0],
        date
    };

    if (!title || !announcementMessage || !type || !audience || !date) {
        return renderAnnouncementsPage(req, res, "Please complete all announcement fields.", formInput);
    }

    try {
        const announcement = await Announcement.findById(id);

        if (!announcement) {
            return renderAnnouncementsPage(req, res, "Announcement not found for update.");
        }

        const titleExists = await Announcement.findOne({
            _id: { $ne: id },
            title: { $regex: `^${escapeRegex(title)}$`, $options: "i" }
        });

        if (titleExists) {
            return renderAnnouncementsPage(req, res, "Another announcement already uses this title.", formInput);
        }

        announcement.title = title;
        announcement.message = announcementMessage;
        announcement.type = type;
        announcement.audience = audience;
        announcement.date = date;

        await announcement.save();

        res.redirect("/announcements");
    } catch (error) {
        console.error("Failed to update announcement:", error.message);
        return renderAnnouncementsPage(req, res, "Unable to update announcement right now.", formInput);
    }
});

app.post("/announcements/delete/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await Announcement.findByIdAndDelete(id);
    } catch (error) {
        console.error("Failed to delete announcement:", error.message);
    }

    res.redirect("/announcements");
});

const PORT = process.env.PORT || 8080;

async function startServer() {
    try {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

if (!process.env.VERCEL) {
    startServer();
}

module.exports = app;



