import { describe, expect, it } from "vitest";
import { renderWithMentions } from "./mentions";
import { isValidElement } from "react";

describe("renderWithMentions", () => {
  it("returns the original string untouched when there is no mention", () => {
    expect(renderWithMentions("привіт, як справи?")).toBe("привіт, як справи?");
  });

  it("wraps an @username token in a highlighted span", () => {
    const result = renderWithMentions("привіт @ivan, як ти?");
    expect(Array.isArray(result)).toBe(true);
    const nodes = result as unknown[];
    const mentionNode = nodes.find(
      (n) => isValidElement(n) && (n.props as { className?: string }).className === "mention",
    );
    expect(mentionNode).toBeTruthy();
    expect(
      isValidElement(mentionNode) && (mentionNode.props as { children?: unknown }).children,
    ).toBe("@ivan");
  });

  it("does not treat a bare @ or a too-short handle as a mention", () => {
    expect(renderWithMentions("email me at a@b")).toBe("email me at a@b");
  });

  it("does not treat the @ inside an e-mail address as a mention", () => {
    const result = renderWithMentions("пиши на ivan@mail.com");
    const nodes = Array.isArray(result) ? result : [result];
    expect(nodes.some((n) => isValidElement(n) && (n.props as { className?: string }).className === "mention")).toBe(false);
  });

  it("hands mentions to a custom renderer when one is given", () => {
    const result = renderWithMentions("привіт @ivan!", (token, key) => `[${token}:${key}]`) as unknown[];
    expect(result).toContain("[@ivan:1]");
  });
});
