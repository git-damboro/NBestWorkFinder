package com.nbwf.modules.resume.repository;

import com.nbwf.modules.resume.model.ResumeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 简历Repository
 */
@Repository
public interface ResumeRepository extends JpaRepository<ResumeEntity, Long> {

    /**
     * 查询当前用户的简历列表
     */
    List<ResumeEntity> findByUserIdOrderByUploadedAtDesc(Long userId);

    /**
     * 在当前用户的数据范围内查询简历详情
     */
    Optional<ResumeEntity> findByIdAndUserId(Long id, Long userId);

    /**
     * 在当前用户的数据范围内按文件哈希查重
     */
    Optional<ResumeEntity> findByFileHashAndUserId(String fileHash, Long userId);
}
