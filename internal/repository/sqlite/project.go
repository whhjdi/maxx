package sqlite

import (
	"database/sql"
	"time"

	"github.com/Bowl42/maxx-next/internal/domain"
)

type ProjectRepository struct {
	db *DB
}

func NewProjectRepository(db *DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) Create(p *domain.Project) error {
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now

	// Generate slug if not provided
	if p.Slug == "" {
		p.Slug = domain.GenerateSlug(p.Name)
	}

	// Ensure slug uniqueness
	baseSlug := p.Slug
	counter := 1
	for {
		var exists bool
		err := r.db.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM projects WHERE slug = ?)`, p.Slug).Scan(&exists)
		if err != nil {
			return err
		}
		if !exists {
			break
		}
		counter++
		p.Slug = baseSlug + "-" + itoa(counter)
	}

	result, err := r.db.db.Exec(
		`INSERT INTO projects (created_at, updated_at, name, slug) VALUES (?, ?, ?, ?)`,
		p.CreatedAt, p.UpdatedAt, p.Name, p.Slug,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	p.ID = uint64(id)
	return nil
}

func (r *ProjectRepository) Update(p *domain.Project) error {
	p.UpdatedAt = time.Now()

	// Check slug uniqueness (excluding current project)
	if p.Slug != "" {
		var exists bool
		err := r.db.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM projects WHERE slug = ? AND id != ?)`, p.Slug, p.ID).Scan(&exists)
		if err != nil {
			return err
		}
		if exists {
			return domain.ErrSlugExists
		}
	}

	_, err := r.db.db.Exec(
		`UPDATE projects SET updated_at = ?, name = ?, slug = ? WHERE id = ?`,
		p.UpdatedAt, p.Name, p.Slug, p.ID,
	)
	return err
}

func (r *ProjectRepository) Delete(id uint64) error {
	_, err := r.db.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

func (r *ProjectRepository) GetByID(id uint64) (*domain.Project, error) {
	row := r.db.db.QueryRow(`SELECT id, created_at, updated_at, name, slug FROM projects WHERE id = ?`, id)
	var p domain.Project
	err := row.Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt, &p.Name, &p.Slug)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *ProjectRepository) GetBySlug(slug string) (*domain.Project, error) {
	row := r.db.db.QueryRow(`SELECT id, created_at, updated_at, name, slug FROM projects WHERE slug = ?`, slug)
	var p domain.Project
	err := row.Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt, &p.Name, &p.Slug)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *ProjectRepository) List() ([]*domain.Project, error) {
	rows, err := r.db.db.Query(`SELECT id, created_at, updated_at, name, slug FROM projects ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*domain.Project
	for rows.Next() {
		var p domain.Project
		err := rows.Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt, &p.Name, &p.Slug)
		if err != nil {
			return nil, err
		}
		projects = append(projects, &p)
	}
	return projects, rows.Err()
}
