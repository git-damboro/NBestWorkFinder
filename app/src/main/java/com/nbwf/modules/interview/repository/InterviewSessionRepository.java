package com.nbwf.modules.interview.repository;

import com.nbwf.modules.interview.model.InterviewSessionEntity;
import com.nbwf.modules.interview.model.InterviewSessionEntity.SessionStatus;
import com.nbwf.modules.resume.model.ResumeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 面试会话Repository
 */
@Repository
public interface InterviewSessionRepository extends JpaRepository<InterviewSessionEntity, Long> {

    /**
     * 根据会话ID查找
     */
    Optional<InterviewSessionEntity> findBySessionId(String sessionId);

    /**
     * 在当前用户范围内根据会话ID查找
     */
    Optional<InterviewSessionEntity> findBySessionIdAndUserId(String sessionId, Long userId);

    /**
     * 根据会话ID查找（同时加载关联的简历）
     */
    @Query("SELECT s FROM InterviewSessionEntity s JOIN FETCH s.resume WHERE s.sessionId = :sessionId")
    Optional<InterviewSessionEntity> findBySessionIdWithResume(@Param("sessionId") String sessionId);

    /**
     * 在当前用户范围内根据会话ID查找（同时加载关联的简历）
     */
    @Query("SELECT s FROM InterviewSessionEntity s JOIN FETCH s.resume WHERE s.sessionId = :sessionId AND s.userId = :userId")
    Optional<InterviewSessionEntity> findBySessionIdWithResumeAndUserId(@Param("sessionId") String sessionId,
                                                                        @Param("userId") Long userId);
    
    /**
     * 根据简历查找所有面试记录
     */
    List<InterviewSessionEntity> findByResumeOrderByCreatedAtDesc(ResumeEntity resume);
    
    /**
     * 根据简历ID查找所有面试记录
     */
    List<InterviewSessionEntity> findByResumeIdOrderByCreatedAtDesc(Long resumeId);

    /**
     * 在当前用户范围内根据简历ID查找所有面试记录
     */
    List<InterviewSessionEntity> findByResumeIdAndUserIdOrderByCreatedAtDesc(Long resumeId, Long userId);

    /**
     * 根据简历ID查找最近的面试记录（用于历史题去重）
     */
    List<InterviewSessionEntity> findTop10ByResumeIdOrderByCreatedAtDesc(Long resumeId);

    /**
     * 在当前用户范围内根据简历ID查找最近的面试记录（用于历史题去重）
     */
    List<InterviewSessionEntity> findTop10ByResumeIdAndUserIdOrderByCreatedAtDesc(Long resumeId, Long userId);
    
    /**
     * 查找简历的未完成面试（CREATED或IN_PROGRESS状态）
     */
    Optional<InterviewSessionEntity> findFirstByResumeIdAndStatusInOrderByCreatedAtDesc(
        Long resumeId, 
        List<SessionStatus> statuses
    );

    /**
     * 在当前用户范围内查找简历的未完成面试
     */
    Optional<InterviewSessionEntity> findFirstByResumeIdAndUserIdAndStatusInOrderByCreatedAtDesc(
        Long resumeId,
        Long userId,
        List<SessionStatus> statuses
    );
    
    /**
     * 根据简历ID和状态查找会话
     */
    Optional<InterviewSessionEntity> findByResumeIdAndStatusIn(
        Long resumeId,
        List<SessionStatus> statuses
    );
}
