#!/usr/bin/env node

import { Client, Databases, Query, Users } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";

function escapeSql(val) {
  if (val === undefined || val === null) return "NULL";
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function fetchAll(collectionId) {
  let allDocs = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    try {
      const resp = await databases.listDocuments(DB_ID, collectionId, [Query.limit(100), Query.offset(offset)]);
      if (resp.documents.length === 0) hasMore = false;
      else {
        allDocs.push(...resp.documents);
        process.stdout.write(`Đã múc ${allDocs.length} từ ${collectionId}...\r`);
        offset += 100;
        await new Promise(r => setTimeout(r, 250));
      }
    } catch {
       return [];
    }
  }
  console.log(`\n✅ ${allDocs.length} ${collectionId}.`);
  return allDocs;
}

async function main() {
  console.log("🕵️‍♂️ Đang cồng lưng tải 18 Collections cuối cùng từ Appwrite...");
  
  const usersService = new Users(client);
  const validUsers = new Set();
  
  let uOffset = 0;
  let uHasMore = true;
  while(uHasMore) {
     const resUser = await usersService.list([Query.limit(100), Query.offset(uOffset)]);
     if(resUser.users.length === 0) uHasMore = false;
     else {
        resUser.users.forEach(u => validUsers.add(u.$id));
        uOffset += 100;
     }
  }

  // Pre-fetch core entities for Foreign Key validation
  const projects = await fetchAll("projects");
  const validProjects = new Set(projects.map(p => p.$id));
  const setlists = await fetchAll("setlists");
  const validSetlists = new Set(setlists.map(s => s.$id));
  const wikiArtists = await fetchAll("wiki_artists");
  const validWikiArtists = new Set(wikiArtists.map(s => s.$id));

  // --- SOCIAL ---
  const posts = await fetchAll("posts");
  const comments = await fetchAll("comments");
  const reactions = await fetchAll("reactions");
  const follows = await fetchAll("follows");
  const favorites = await fetchAll("favorites");
  const notifications = await fetchAll("notifications");
  const reports = await fetchAll("reports");

  const validPosts = new Set(posts.filter(p => validUsers.has(p.authorId)).map(p => p.$id));
  const validComments = new Set(comments.filter(c => validPosts.has(c.postId) && validUsers.has(c.authorId)).map(c => c.$id));

  // --- CLASSROOM ---
  const classrooms = await fetchAll("classrooms");
  const validClassrooms = new Set(classrooms.filter(c => validUsers.has(c.teacherId)).map(c => c.$id));
  
  const classroomMembers = await fetchAll("classroom_members");
  const classroomInvites = await fetchAll("classroom_invites");
  const classroomMaterials = await fetchAll("classroom_materials");
  const assignments = await fetchAll("assignments");
  const validAssignments = new Set(assignments.filter(a => validClassrooms.has(a.classroomId)).map(a => a.$id));
  const submissions = await fetchAll("submissions");
  const validSubmissions = new Set(submissions.filter(s => validAssignments.has(s.assignmentId) && validClassrooms.has(s.classroomId) && validUsers.has(s.studentId)).map(s => s.$id));
  const submissionFeedback = await fetchAll("submission_feedback");

  // --- COURSES ---
  const courses = await fetchAll("courses");
  const validCourses = new Set(courses.map(c => c.$id)); // Courses don't have user_id in Appwrite schema according to my migration
  
  const lessons = await fetchAll("lessons");
  const validLessons = new Set(lessons.filter(l => validCourses.has(l.courseId)).map(l => l.$id));
  const enrollments = await fetchAll("enrollments");
  const progress = await fetchAll("progress");

  // --- MONETIZATION ---
  const subscriptions = await fetchAll("subscriptions");

  const sqlCommands = [
    "PRAGMA defer_foreign_keys = TRUE;",
    "PRAGMA foreign_keys = OFF;"
  ];

  /* -------------------------------------------------------------------------- */
  /* COURSES                                                                    */
  /* -------------------------------------------------------------------------- */
  for (const doc of courses) {
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO courses (id, title, description, cover_url, difficulty, price_cents, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.title)}, ${escapeSql(doc.description)}, ${escapeSql(doc.coverUrl)}, ${escapeSql(doc.difficulty)}, ${doc.priceCents || 0}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of lessons) {
     if (!validCourses.has(doc.courseId)) continue;
     const pId = validProjects.has(doc.projectId) ? doc.projectId : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO lessons (id, course_id, title, order_index, project_id, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.courseId)}, ${escapeSql(doc.title)}, ${doc.orderIndex || 0}, ${escapeSql(pId)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of enrollments) {
     if (!validUsers.has(doc.userId) || !validCourses.has(doc.courseId)) continue;
     const enrolledAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO enrollments (id, user_id, course_id, enrolled_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.courseId)}, ${enrolledAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of progress) {
     if (!validUsers.has(doc.userId) || !validLessons.has(doc.lessonId)) continue;
     const updatedAt = new Date(doc.$updatedAt).getTime();
     sqlCommands.push(`INSERT INTO progress (id, user_id, lesson_id, status, updated_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.lessonId)}, ${escapeSql(doc.status || 'completed')}, ${updatedAt}) ON CONFLICT DO NOTHING;`);
  }

  /* -------------------------------------------------------------------------- */
  /* CLASSROOM                                                                  */
  /* -------------------------------------------------------------------------- */
  for (const doc of classrooms) {
     if (!validUsers.has(doc.teacherId)) continue;
     const cId = validCourses.has(doc.courseId) ? doc.courseId : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO classrooms (id, teacher_id, name, description, cover_image, instrument_focus, level, course_id, class_code, status, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.teacherId)}, ${escapeSql(doc.name)}, ${escapeSql(doc.description)}, ${escapeSql(doc.coverImage)}, ${escapeSql(doc.instrumentFocus)}, ${escapeSql(doc.level)}, ${escapeSql(cId)}, ${escapeSql(doc.classCode || doc.$id)}, ${escapeSql(doc.status || 'active')}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of classroomMembers) {
     if (!validClassrooms.has(doc.classroomId) || !validUsers.has(doc.userId)) continue;
     const joinedAt = new Date(doc.joinedAt || doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO classroom_members (id, classroom_id, user_id, user_name, role, status, joined_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.classroomId)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.userName || 'Student')}, ${escapeSql(doc.role || 'student')}, ${escapeSql(doc.status || 'active')}, ${joinedAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of classroomInvites) {
     const cId = validClassrooms.has(doc.classroomId) ? doc.classroomId : null;
     const clsId = validCourses.has(doc.courseId) ? doc.courseId : null;
     if (!validUsers.has(doc.teacherId)) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     const exAt = doc.expiresAt ? new Date(doc.expiresAt).getTime() : null;
     sqlCommands.push(`INSERT INTO classroom_invites (id, code, classroom_id, course_id, teacher_id, student_name, status, used_by_id, expires_at, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.code || doc.$id)}, ${escapeSql(cId)}, ${escapeSql(clsId)}, ${escapeSql(doc.teacherId)}, ${escapeSql(doc.studentName)}, ${escapeSql(doc.status || 'active')}, ${escapeSql(doc.usedById)}, ${exAt}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of classroomMaterials) {
     if (!validClassrooms.has(doc.classroomId) || !validProjects.has(doc.sheetMusicId) || !validUsers.has(doc.sharedById)) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO classroom_materials (id, classroom_id, sheet_music_id, shared_by_id, note, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.classroomId)}, ${escapeSql(doc.sheetMusicId)}, ${escapeSql(doc.sharedById)}, ${escapeSql(doc.note)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of assignments) {
     if (!validClassrooms.has(doc.classroomId)) continue;
     const srcUrl = doc.sheetMusicId && validProjects.has(doc.sheetMusicId) ? doc.sheetMusicId : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO assignments (id, classroom_id, title, description, source_type, source_id, sheet_music_id, type, wait_mode_required, deadline, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.classroomId)}, ${escapeSql(doc.title)}, ${escapeSql(doc.description)}, ${escapeSql(doc.sourceType)}, ${escapeSql(doc.sourceId)}, ${escapeSql(srcUrl)}, ${escapeSql(doc.type)}, ${doc.waitModeRequired?1:0}, ${escapeSql(doc.deadline)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of submissions) {
     if (!validAssignments.has(doc.assignmentId) || !validClassrooms.has(doc.classroomId) || !validUsers.has(doc.studentId)) continue;
     const subAt = doc.submittedAt ? new Date(doc.submittedAt).getTime() : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO submissions (id, assignment_id, classroom_id, student_id, student_name, recording_file_id, accuracy, tempo, attempts, status, submitted_at, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.assignmentId)}, ${escapeSql(doc.classroomId)}, ${escapeSql(doc.studentId)}, ${escapeSql(doc.studentName)}, ${escapeSql(doc.recordingFileId)}, ${doc.accuracy}, ${doc.tempo}, ${doc.attempts||0}, ${escapeSql(doc.status)}, ${subAt}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of submissionFeedback) {
     if (!validSubmissions.has(doc.submissionId) || !validUsers.has(doc.teacherId)) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO submission_feedback (id, submission_id, teacher_id, teacher_name, content, grade, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.submissionId)}, ${escapeSql(doc.teacherId)}, ${escapeSql(doc.teacherName)}, ${escapeSql(doc.content)}, ${doc.grade}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  /* -------------------------------------------------------------------------- */
  /* SOCIAL                                                                     */
  /* -------------------------------------------------------------------------- */
  for (const doc of posts) {
     if (!validUsers.has(doc.authorId)) continue;
     const pId = doc.attachmentType === 'project' && validProjects.has(doc.attachmentId) ? doc.attachmentId : null;
     const sId = doc.attachmentType === 'playlist' && validSetlists.has(doc.attachmentId) ? doc.attachmentId : null;
     const cstId = validClassrooms.has(doc.classroomId) ? doc.classroomId : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO posts (id, author_id, content, attached_project_id, attached_setlist_id, visibility, classroom_id, is_pinned, reaction_like, reaction_love, reaction_haha, reaction_wow, reaction_total, comments_count, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.authorId)}, ${escapeSql(doc.content)}, ${escapeSql(pId)}, ${escapeSql(sId)}, ${escapeSql(doc.visibility||'public')}, ${escapeSql(cstId)}, ${doc.isPinned?1:0}, ${doc.reactionLike||0}, ${doc.reactionLove||0}, ${doc.reactionHaha||0}, ${doc.reactionWow||0}, ${doc.reactionTotal||0}, ${doc.commentsCount||0}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }
  for (const doc of comments) {
     if (!validPosts.has(doc.postId) || !validUsers.has(doc.authorId)) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.postId)}, ${escapeSql(doc.authorId)}, ${escapeSql(doc.content)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  // Polymorphic Reactions
  for (const doc of reactions) {
     if (!validUsers.has(doc.userId)) continue;
     const isPost = doc.targetType === 'post' && validPosts.has(doc.targetId) ? doc.targetId : null;
     const isCom = doc.targetType === 'comment' && validComments.has(doc.targetId) ? doc.targetId : null;
     const isProj = doc.targetType === 'project' && validProjects.has(doc.targetId) ? doc.targetId : null;
     const isSetlist = doc.targetType === 'playlist' && validSetlists.has(doc.targetId) ? doc.targetId : null;
     
     if (!isPost && !isCom && !isProj && !isSetlist) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO reactions (id, user_id, type, post_id, comment_id, project_id, setlist_id, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.type)}, ${escapeSql(isPost)}, ${escapeSql(isCom)}, ${escapeSql(isProj)}, ${escapeSql(isSetlist)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  // Follows
  for (const doc of follows) {
     if (!validUsers.has(doc.followerId) || !validUsers.has(doc.followingId)) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.followerId)}, ${escapeSql(doc.followingId)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  // Polymorphic Favorites
  for (const doc of favorites) {
     if (!validUsers.has(doc.userId)) continue;
     const tProj = (doc.targetType === 'project' || doc.targetType === 'sheet_music') && validProjects.has(doc.targetId) ? doc.targetId : null;
     const tSetlist = doc.targetType === 'playlist' && validSetlists.has(doc.targetId) ? doc.targetId : null;
     const tCourse = doc.targetType === 'course' && validCourses.has(doc.targetId) ? doc.targetId : null;
     const tWiki = doc.targetType === 'wiki_entity' && validWikiArtists.has(doc.targetId) ? doc.targetId : null;

     if (!tProj && !tSetlist && !tCourse && !tWiki) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO favorites (id, user_id, project_id, setlist_id, course_id, wiki_artist_id, target_type_backup, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(tProj)}, ${escapeSql(tSetlist)}, ${escapeSql(tCourse)}, ${escapeSql(tWiki)}, ${escapeSql(doc.targetType)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  // Notifications
  for (const doc of notifications) {
     if (!validUsers.has(doc.userId)) continue;
     const aId = validUsers.has(doc.actorId) ? doc.actorId : null;
     const pId = validPosts.has(doc.postId) ? doc.postId : null;
     const prjId = validProjects.has(doc.projectId) ? doc.projectId : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO notifications (id, user_id, actor_id, type, message, read, post_id, project_id, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(aId)}, ${escapeSql(doc.type)}, ${escapeSql(doc.message)}, ${doc.isRead?1:0}, ${escapeSql(pId)}, ${escapeSql(prjId)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  // Reports
  for (const doc of reports) {
     if (!validUsers.has(doc.reporterId)) continue;
     const tPost = doc.targetType === 'post' && validPosts.has(doc.targetId) ? doc.targetId : null;
     const tCom = doc.targetType === 'comment' && validComments.has(doc.targetId) ? doc.targetId : null;
     const tUser = doc.targetType === 'user' && validUsers.has(doc.targetId) ? doc.targetId : null;
     const createdAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO reports (id, reporter_id, reason, status, post_id, comment_id, user_id_reported, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.reporterId)}, ${escapeSql(doc.reason)}, ${escapeSql(doc.status||'pending')}, ${escapeSql(tPost)}, ${escapeSql(tCom)}, ${escapeSql(tUser)}, ${createdAt}) ON CONFLICT DO NOTHING;`);
  }

  /* -------------------------------------------------------------------------- */
  /* SUBSCRIPTIONS                                                              */
  /* -------------------------------------------------------------------------- */
  for (const doc of subscriptions) {
     if (!validUsers.has(doc.userId)) continue;
     const cEnd = new Date(doc.currentPeriodEnd || doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO subscriptions (id, user_id, status, plan_id, current_period_end, cancel_at_period_end) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.status || 'canceled')}, ${escapeSql(doc.planId || 'legacy_plan')}, ${cEnd}, ${doc.cancelAtPeriodEnd?1:0}) ON CONFLICT DO NOTHING;`);
  }

  const out = path.join(process.cwd(), "scripts", "v5", "dump_remaining.sql");
  fs.writeFileSync(out, sqlCommands.join("\n"));
  console.log(`\n🎉 TRẬN ĐÁNH CUỐI CÙNG ĐÃ KẾT THÚC! SẠCH SẼ APPWRITE! => ${out}`);
}

main().catch(console.error);
