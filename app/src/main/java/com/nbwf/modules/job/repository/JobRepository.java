package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobRepository extends JpaRepository<JobEntity, Long> {

    List<JobEntity> findByStatusOrderByCreatedAtDesc(JobStatus status);

    List<JobEntity> findAllByOrderByCreatedAtDesc();
}
