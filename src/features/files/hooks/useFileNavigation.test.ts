import { describe, expect, it } from "vitest";
import {
  isJavaFile,
  isXmlMapperFile,
  isMapperInterface,
} from "./useFileNavigation";

describe("useFileNavigation file type detection", () => {
  describe("isJavaFile", () => {
    it("returns true for .java files", () => {
      expect(isJavaFile("src/main/java/com/example/UserService.java")).toBe(true);
      expect(isJavaFile("Foo.java")).toBe(true);
    });

    it("returns false for non-Java files", () => {
      expect(isJavaFile("src/main/resources/mapper/UserMapper.xml")).toBe(false);
      expect(isJavaFile("README.md")).toBe(false);
      expect(isJavaFile("app.tsx")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isJavaFile("Foo.JAVA")).toBe(true);
      expect(isJavaFile("Foo.Java")).toBe(true);
    });
  });

  describe("isXmlMapperFile", () => {
    it("returns true for Mapper.xml files", () => {
      expect(isXmlMapperFile("src/main/resources/mapper/UserMapper.xml")).toBe(true);
      expect(isXmlMapperFile("UserMapper.xml")).toBe(true);
    });

    it("returns true for mapper.xml files", () => {
      expect(isXmlMapperFile("src/main/resources/mapper/mapper.xml")).toBe(true);
    });

    it("returns false for non-mapper XML files", () => {
      expect(isXmlMapperFile("pom.xml")).toBe(false);
      expect(isXmlMapperFile("application.xml")).toBe(false);
      expect(isXmlMapperFile("UserMapper.java")).toBe(false);
    });
  });

  describe("isMapperInterface", () => {
    it("returns true for Java files with @Mapper annotation", () => {
      expect(
        isMapperInterface("UserMapper.java", "@Mapper\npublic interface UserMapper {}"),
      ).toBe(true);
    });

    it("returns true for Java files extending BaseMapper", () => {
      expect(
        isMapperInterface(
          "UserMapper.java",
          "public interface UserMapper extends BaseMapper<User> {}",
        ),
      ).toBe(true);
    });

    it("returns false for non-Java files", () => {
      expect(isMapperInterface("UserMapper.xml", "@Mapper")).toBe(false);
    });

    it("returns false for Java files without mapper annotation", () => {
      expect(isMapperInterface("UserService.java", "public class UserService {}")).toBe(false);
    });

    it("returns false when content is not provided", () => {
      expect(isMapperInterface("UserMapper.java")).toBe(false);
    });
  });
});
