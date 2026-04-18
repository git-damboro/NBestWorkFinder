package com.nbwf.modules.resume.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.infrastructure.file.FileStorageService;
import com.nbwf.modules.interview.service.InterviewPersistenceService;
import com.nbwf.modules.resume.model.ResumeEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 简历删除服务
 * 处理简历删除的业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeDeleteService {
    
    private final ResumePersistenceService persistenceService;
    private final InterviewPersistenceService interviewPersistenceService;
    private final FileStorageService storageService;
    
    /**
     * 删除简历
     *
     * @param id 简历ID
     * @param userId 当前登录用户ID
     * @throws com.nbwf.common.exception.BusinessException 如果简历不存在
     */
    public void deleteResume(Long id, Long userId) {
        log.info("收到删除简历请求: id={}", id);
        
        // 先在当前用户范围内取回简历，避免跨用户删除
        ResumeEntity resume = persistenceService.findById(id, userId)
            .orElseThrow(() -> new BusinessException(
                ErrorCode.RESUME_NOT_FOUND));
        
        // 1. 删除存储的文件（FileStorageService 已内置存在性检查）
        try {
            storageService.deleteResume(resume.getStorageKey());
        } catch (Exception e) {
            log.warn("删除存储文件失败，继续删除数据库记录: {}", e.getMessage());
        }
        
        // 2. 删除面试会话（会自动删除面试答案）
        interviewPersistenceService.deleteSessionsByResumeId(id, userId);
        
        // 3. 删除数据库记录（包括分析记录）
        persistenceService.deleteResume(id, userId);
        
        log.info("简历删除完成: id={}", id);
    }
}
