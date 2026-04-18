package com.nbwf.modules.knowledgebase.repository;

import com.nbwf.modules.knowledgebase.model.KnowledgeBaseEntity;
import com.nbwf.modules.knowledgebase.model.VectorStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 知识库Repository
 */
@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseEntity, Long> {

    /**
     * 在当前用户范围内根据文件哈希查找知识库（用于去重）
     */
    Optional<KnowledgeBaseEntity> findByFileHashAndUserId(String fileHash, Long userId);

    /**
     * 在当前用户范围内根据ID查找知识库
     */
    Optional<KnowledgeBaseEntity> findByIdAndUserId(Long id, Long userId);

    /**
     * 按上传时间倒序查找当前用户的所有知识库
     */
    List<KnowledgeBaseEntity> findByUserIdOrderByUploadedAtDesc(Long userId);

    /**
     * 按上传时间倒序查找当前用户指定状态的知识库
     */
    List<KnowledgeBaseEntity> findByUserIdAndVectorStatusOrderByUploadedAtDesc(Long userId, VectorStatus vectorStatus);

    /**
     * 获取当前用户所有不同的分类
     */
    @Query("SELECT DISTINCT k.category FROM KnowledgeBaseEntity k WHERE k.userId = :userId AND k.category IS NOT NULL ORDER BY k.category")
    List<String> findAllCategoriesByUserId(@Param("userId") Long userId);

    /**
     * 根据分类查找当前用户知识库
     */
    List<KnowledgeBaseEntity> findByUserIdAndCategoryOrderByUploadedAtDesc(Long userId, String category);

    /**
     * 查找当前用户未分类的知识库
     */
    List<KnowledgeBaseEntity> findByUserIdAndCategoryIsNullOrderByUploadedAtDesc(Long userId);

    /**
     * 按名称或文件名模糊搜索当前用户知识库（不区分大小写）
     */
    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.userId = :userId AND (LOWER(k.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(k.originalFilename) LIKE LOWER(CONCAT('%', :keyword, '%'))) ORDER BY k.uploadedAt DESC")
    List<KnowledgeBaseEntity> searchByUserIdAndKeyword(@Param("userId") Long userId, @Param("keyword") String keyword);

    /**
     * 按ID列表查询当前用户拥有的知识库
     */
    List<KnowledgeBaseEntity> findAllByIdInAndUserId(List<Long> ids, Long userId);

    // ==================== 批量更新 ====================

    /**
     * 批量增加知识库提问计数
     * @param ids 知识库ID列表
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE KnowledgeBaseEntity k SET k.questionCount = k.questionCount + 1 WHERE k.userId = :userId AND k.id IN :ids")
    int incrementQuestionCountBatch(@Param("userId") Long userId, @Param("ids") List<Long> ids);

    // ==================== 统计查询 ====================

    /**
     * 统计总提问次数
     */
    @Query("SELECT COALESCE(SUM(k.questionCount), 0) FROM KnowledgeBaseEntity k WHERE k.userId = :userId")
    long sumQuestionCountByUserId(@Param("userId") Long userId);

    /**
     * 统计总访问次数
     */
    @Query("SELECT COALESCE(SUM(k.accessCount), 0) FROM KnowledgeBaseEntity k WHERE k.userId = :userId")
    long sumAccessCountByUserId(@Param("userId") Long userId);

    /**
     * 按向量化状态统计数量
     */
    long countByUserIdAndVectorStatus(Long userId, VectorStatus vectorStatus);

    /**
     * 统计当前用户知识库总数
     */
    long countByUserId(Long userId);

}
