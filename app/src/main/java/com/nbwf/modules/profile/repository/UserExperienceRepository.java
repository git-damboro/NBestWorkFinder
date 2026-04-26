package com.nbwf.modules.profile.repository;

import com.nbwf.modules.profile.model.UserExperienceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserExperienceRepository extends JpaRepository<UserExperienceEntity, Long> {
    List<UserExperienceEntity> findByUserIdOrderByEnabledDescUpdatedAtDesc(Long userId);

    List<UserExperienceEntity> findByUserIdAndEnabledTrueOrderByUpdatedAtDesc(Long userId);

    Optional<UserExperienceEntity> findByIdAndUserId(Long id, Long userId);
}
