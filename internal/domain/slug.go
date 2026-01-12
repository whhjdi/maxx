package domain

import (
	"regexp"
	"strings"
)

var (
	// 匹配非字母数字字符
	nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)
	// 匹配开头和结尾的连字符
	trimHyphenRegex = regexp.MustCompile(`^-+|-+$`)
)

// GenerateSlug 从名称生成 URL 友好的 slug
func GenerateSlug(name string) string {
	// 转换为小写
	slug := strings.ToLower(name)

	// 替换非字母数字字符为连字符
	slug = nonAlphanumericRegex.ReplaceAllString(slug, "-")

	// 移除开头和结尾的连字符
	slug = trimHyphenRegex.ReplaceAllString(slug, "")

	// 如果结果为空，返回默认值
	if slug == "" {
		slug = "project"
	}

	return slug
}
