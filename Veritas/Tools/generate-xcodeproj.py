#!/usr/bin/env python3
"""Regenerate Veritas.xcodeproj from whatever is on disk.

Two deliberate choices here, both made because this project is maintained
without a Mac in the loop and nothing can be verified locally:

1. **Classic pbxproj format** (objectVersion 56), with an explicit
   reference for every file, rather than Xcode 16's file-system
   synchronized groups. The newer format is much tidier and silently shows
   an empty navigator on an older Xcode.

2. **No Swift package reference.** VeritasKit's sources are compiled
   directly into the app target instead of being linked as a local
   package. `XCLocalSwiftPackageReference` needs Xcode 15+, and a project
   Xcode refuses to parse opens as an empty window with no useful error.
   What is left in this file is nothing newer than Xcode 4 understands.

   The package is still a real package: `Packages/VeritasKit/Package.swift`
   is untouched and `swift test` runs the whole suite there. The app just
   shares the same source files rather than linking a built product, which
   is why no app file imports VeritasKit.

Run after adding or deleting any file under Veritas/ or the engine:

    python3 Tools/generate-xcodeproj.py

Object ids are derived from file paths, so rerunning is byte-identical and
diffs stay readable.
"""

import hashlib
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.join(ROOT, "Veritas.xcodeproj", "project.pbxproj")

# (key, path relative to the project directory)
SOURCE_ROOTS = [
    ("app", "Veritas"),
    ("kit", os.path.join("Packages", "VeritasKit", "Sources", "VeritasKit")),
]

BUNDLE_ID = "dev.veritas.app"
IOS_MIN = "17.0"
MACOS_MIN = "14.0"

FILE_TYPES = {
    ".swift": "sourcecode.swift",
    ".xcassets": "folder.assetcatalog",
    ".entitlements": "text.plist.entitlements",
    ".plist": "text.plist.xml",
}


def gid(*parts):
    """A stable 24-hex object id derived from the given key."""
    return hashlib.sha1("::".join(parts).encode()).hexdigest()[:24].upper()


def file_type(path):
    return FILE_TYPES.get(os.path.splitext(path)[1], "text")


def collect(base):
    """Files under `base`, relative to it, split by how they get built."""
    sources, resources, others = [], [], []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for name in list(dirnames):
            # Asset catalogues are one reference, not a directory to descend.
            if name.endswith(".xcassets"):
                dirnames.remove(name)
                resources.append(os.path.relpath(os.path.join(dirpath, name), base))
        for name in sorted(filenames):
            if name.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), base)
            if name.endswith(".swift"):
                sources.append(rel)
            elif name.endswith(".entitlements"):
                others.append(rel)
            else:
                resources.append(rel)
    return sorted(sources), sorted(resources), sorted(others)


def build_tree(paths):
    """Directory -> its immediate subdirectories and files."""
    tree = {"": {"dirs": set(), "files": []}}
    for path in paths:
        parts = path.split(os.sep)
        for depth in range(len(parts) - 1):
            parent = os.sep.join(parts[:depth]) if depth else ""
            child = os.sep.join(parts[: depth + 1])
            tree.setdefault(parent, {"dirs": set(), "files": []})
            tree.setdefault(child, {"dirs": set(), "files": []})
            tree[parent]["dirs"].add(child)
        parent = os.sep.join(parts[:-1])
        tree.setdefault(parent, {"dirs": set(), "files": []})
        tree[parent]["files"].append(path)
    return tree


def main():
    roots = []
    for key, rel in SOURCE_ROOTS:
        base = os.path.join(ROOT, rel)
        if not os.path.isdir(base):
            sys.exit("missing source root: %s" % rel)
        sources, resources, others = collect(base)
        roots.append({
            "key": key,
            "rel": rel,
            "name": os.path.basename(rel),
            "sources": sources,
            "resources": resources,
            "others": others,
            "tree": build_tree(sources + resources + others),
        })

    if not any(root["sources"] for root in roots):
        sys.exit("no Swift files found")

    project_id = gid("project")
    main_group = gid("group", "main")
    products_group = gid("group", "products")
    target_id = gid("target", "Veritas")
    product_ref = gid("product", "Veritas.app")
    sources_phase = gid("phase", "sources")
    frameworks_phase = gid("phase", "frameworks")
    resources_phase = gid("phase", "resources")
    project_config_list = gid("configlist", "project")
    target_config_list = gid("configlist", "target")

    out = []
    w = out.append

    w("// !$*UTF8*$!")
    w("{")
    w("\tarchiveVersion = 1;")
    w("\tclasses = {")
    w("\t};")
    w("\tobjectVersion = 56;")
    w("\tobjects = {")
    w("")

    # --- PBXBuildFile ----------------------------------------------------
    w("/* Begin PBXBuildFile section */")
    for root in roots:
        for path in root["sources"]:
            w("\t\t%s /* %s in Sources */ = {isa = PBXBuildFile; fileRef = %s /* %s */; };"
              % (gid("buildfile", root["key"], path), os.path.basename(path),
                 gid("fileref", root["key"], path), os.path.basename(path)))
        for path in root["resources"]:
            w("\t\t%s /* %s in Resources */ = {isa = PBXBuildFile; fileRef = %s /* %s */; };"
              % (gid("buildfile", root["key"], path), os.path.basename(path),
                 gid("fileref", root["key"], path), os.path.basename(path)))
    w("/* End PBXBuildFile section */")
    w("")

    # --- PBXFileReference ------------------------------------------------
    w("/* Begin PBXFileReference section */")
    w("\t\t%s /* Veritas.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Veritas.app; sourceTree = BUILT_PRODUCTS_DIR; };"
      % product_ref)
    for root in roots:
        for path in root["sources"] + root["resources"] + root["others"]:
            name = os.path.basename(path)
            w("\t\t%s /* %s */ = {isa = PBXFileReference; lastKnownFileType = %s; path = %s; sourceTree = \"<group>\"; };"
              % (gid("fileref", root["key"], path), name, file_type(path), name))
    w("/* End PBXFileReference section */")
    w("")

    # --- PBXFrameworksBuildPhase ----------------------------------------
    # Empty: the engine is compiled in, not linked.
    w("/* Begin PBXFrameworksBuildPhase section */")
    w("\t\t%s /* Frameworks */ = {" % frameworks_phase)
    w("\t\t\tisa = PBXFrameworksBuildPhase;")
    w("\t\t\tbuildActionMask = 2147483647;")
    w("\t\t\tfiles = (")
    w("\t\t\t);")
    w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    w("\t\t};")
    w("/* End PBXFrameworksBuildPhase section */")
    w("")

    # --- PBXGroup --------------------------------------------------------
    w("/* Begin PBXGroup section */")
    w("\t\t%s = {" % main_group)
    w("\t\t\tisa = PBXGroup;")
    w("\t\t\tchildren = (")
    for root in roots:
        w("\t\t\t\t%s /* %s */," % (gid("group", root["key"], ""), root["name"]))
    w("\t\t\t\t%s /* Products */," % products_group)
    w("\t\t\t);")
    w("\t\t\tsourceTree = \"<group>\";")
    w("\t\t};")

    w("\t\t%s /* Products */ = {" % products_group)
    w("\t\t\tisa = PBXGroup;")
    w("\t\t\tchildren = (")
    w("\t\t\t\t%s /* Veritas.app */," % product_ref)
    w("\t\t\t);")
    w("\t\t\tname = Products;")
    w("\t\t\tsourceTree = \"<group>\";")
    w("\t\t};")

    for root in roots:
        for directory in sorted(root["tree"]):
            node = root["tree"][directory]
            is_root = directory == ""
            group_id = gid("group", root["key"], directory)
            label = root["name"] if is_root else os.path.basename(directory)
            w("\t\t%s /* %s */ = {" % (group_id, label))
            w("\t\t\tisa = PBXGroup;")
            w("\t\t\tchildren = (")
            for child in sorted(node["dirs"]):
                w("\t\t\t\t%s /* %s */," % (gid("group", root["key"], child), os.path.basename(child)))
            for path in sorted(node["files"]):
                w("\t\t\t\t%s /* %s */," % (gid("fileref", root["key"], path), os.path.basename(path)))
            w("\t\t\t);")
            if is_root:
                # The engine's group sits several directories down, so the
                # group carries the full relative path and a short name.
                if root["rel"] != root["name"]:
                    w("\t\t\tname = %s;" % root["name"])
                w("\t\t\tpath = %s;" % root["rel"].replace(os.sep, "/"))
            else:
                w("\t\t\tpath = %s;" % os.path.basename(directory))
            w("\t\t\tsourceTree = \"<group>\";")
            w("\t\t};")
    w("/* End PBXGroup section */")
    w("")

    # --- PBXNativeTarget -------------------------------------------------
    w("/* Begin PBXNativeTarget section */")
    w("\t\t%s /* Veritas */ = {" % target_id)
    w("\t\t\tisa = PBXNativeTarget;")
    w("\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXNativeTarget \"Veritas\" */;" % target_config_list)
    w("\t\t\tbuildPhases = (")
    w("\t\t\t\t%s /* Sources */," % sources_phase)
    w("\t\t\t\t%s /* Frameworks */," % frameworks_phase)
    w("\t\t\t\t%s /* Resources */," % resources_phase)
    w("\t\t\t);")
    w("\t\t\tbuildRules = (")
    w("\t\t\t);")
    w("\t\t\tdependencies = (")
    w("\t\t\t);")
    w("\t\t\tname = Veritas;")
    w("\t\t\tproductName = Veritas;")
    w("\t\t\tproductReference = %s /* Veritas.app */;" % product_ref)
    w("\t\t\tproductType = \"com.apple.product-type.application\";")
    w("\t\t};")
    w("/* End PBXNativeTarget section */")
    w("")

    # --- PBXProject ------------------------------------------------------
    w("/* Begin PBXProject section */")
    w("\t\t%s /* Project object */ = {" % project_id)
    w("\t\t\tisa = PBXProject;")
    w("\t\t\tattributes = {")
    w("\t\t\t\tLastSwiftUpdateCheck = 1500;")
    w("\t\t\t\tLastUpgradeCheck = 1500;")
    w("\t\t\t\tTargetAttributes = {")
    w("\t\t\t\t\t%s = {" % target_id)
    w("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    w("\t\t\t\t\t};")
    w("\t\t\t\t};")
    w("\t\t\t};")
    w("\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXProject \"Veritas\" */;" % project_config_list)
    w("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
    w("\t\t\tdevelopmentRegion = en;")
    w("\t\t\thasScannedForEncodings = 0;")
    w("\t\t\tknownRegions = (")
    w("\t\t\t\ten,")
    w("\t\t\t\tBase,")
    w("\t\t\t);")
    w("\t\t\tmainGroup = %s;" % main_group)
    w("\t\t\tproductRefGroup = %s /* Products */;" % products_group)
    w("\t\t\tprojectDirPath = \"\";")
    w("\t\t\tprojectRoot = \"\";")
    w("\t\t\ttargets = (")
    w("\t\t\t\t%s /* Veritas */," % target_id)
    w("\t\t\t);")
    w("\t\t};")
    w("/* End PBXProject section */")
    w("")

    # --- PBXResourcesBuildPhase -----------------------------------------
    w("/* Begin PBXResourcesBuildPhase section */")
    w("\t\t%s /* Resources */ = {" % resources_phase)
    w("\t\t\tisa = PBXResourcesBuildPhase;")
    w("\t\t\tbuildActionMask = 2147483647;")
    w("\t\t\tfiles = (")
    for root in roots:
        for path in root["resources"]:
            w("\t\t\t\t%s /* %s in Resources */," % (gid("buildfile", root["key"], path), os.path.basename(path)))
    w("\t\t\t);")
    w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    w("\t\t};")
    w("/* End PBXResourcesBuildPhase section */")
    w("")

    # --- PBXSourcesBuildPhase -------------------------------------------
    w("/* Begin PBXSourcesBuildPhase section */")
    w("\t\t%s /* Sources */ = {" % sources_phase)
    w("\t\t\tisa = PBXSourcesBuildPhase;")
    w("\t\t\tbuildActionMask = 2147483647;")
    w("\t\t\tfiles = (")
    for root in roots:
        for path in root["sources"]:
            w("\t\t\t\t%s /* %s in Sources */," % (gid("buildfile", root["key"], path), os.path.basename(path)))
    w("\t\t\t);")
    w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    w("\t\t};")
    w("/* End PBXSourcesBuildPhase section */")
    w("")

    # --- build configurations -------------------------------------------
    shared = [
        "ALWAYS_SEARCH_USER_PATHS = NO;",
        "CLANG_ANALYZER_NONNULL = YES;",
        "CLANG_ENABLE_MODULES = YES;",
        "CLANG_ENABLE_OBJC_ARC = YES;",
        "CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;",
        "COPY_PHASE_STRIP = NO;",
        "ENABLE_STRICT_OBJC_MSGSEND = YES;",
        "GCC_NO_COMMON_BLOCKS = YES;",
        "IPHONEOS_DEPLOYMENT_TARGET = %s;" % IOS_MIN,
        "MACOSX_DEPLOYMENT_TARGET = %s;" % MACOS_MIN,
        "SDKROOT = auto;",
        "SUPPORTED_PLATFORMS = \"iphoneos iphonesimulator macosx\";",
        "SWIFT_VERSION = 5.0;",
    ]
    debug_only = [
        "DEBUG_INFORMATION_FORMAT = dwarf;",
        "ENABLE_TESTABILITY = YES;",
        "GCC_OPTIMIZATION_LEVEL = 0;",
        "MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;",
        "ONLY_ACTIVE_ARCH = YES;",
        "SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;",
        "SWIFT_OPTIMIZATION_LEVEL = \"-Onone\";",
    ]
    release_only = [
        "DEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";",
        "MTL_ENABLE_DEBUG_INFO = NO;",
        "SWIFT_COMPILATION_MODE = wholemodule;",
        "VALIDATE_PRODUCT = YES;",
    ]
    target_shared = [
        "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;",
        "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;",
        "\"CODE_SIGN_ENTITLEMENTS[sdk=macosx*]\" = Veritas/Veritas.entitlements;",
        "CODE_SIGN_STYLE = Automatic;",
        "CURRENT_PROJECT_VERSION = 1;",
        "\"ENABLE_HARDENED_RUNTIME[sdk=macosx*]\" = YES;",
        "ENABLE_PREVIEWS = YES;",
        "GENERATE_INFOPLIST_FILE = YES;",
        "INFOPLIST_KEY_CFBundleDisplayName = Veritas;",
        "INFOPLIST_KEY_NSMicrophoneUsageDescription = \"Veritas uses the microphone so you can speak your turn instead of typing it.\";",
        "INFOPLIST_KEY_NSSpeechRecognitionUsageDescription = \"Veritas transcribes your spoken turn so the referee can analyse what was said.\";",
        "\"INFOPLIST_KEY_UILaunchScreen_Generation[sdk=iphoneos*]\" = YES;",
        "\"INFOPLIST_KEY_UILaunchScreen_Generation[sdk=iphonesimulator*]\" = YES;",
        "MARKETING_VERSION = 1.0;",
        "PRODUCT_BUNDLE_IDENTIFIER = %s;" % BUNDLE_ID,
        "PRODUCT_NAME = \"$(TARGET_NAME)\";",
        "SWIFT_EMIT_LOC_STRINGS = YES;",
        "TARGETED_DEVICE_FAMILY = \"1,2\";",
    ]

    def configuration(config_id, name, settings):
        w("\t\t%s /* %s */ = {" % (config_id, name))
        w("\t\t\tisa = XCBuildConfiguration;")
        w("\t\t\tbuildSettings = {")
        for setting in settings:
            w("\t\t\t\t%s" % setting)
        w("\t\t\t};")
        w("\t\t\tname = %s;" % name)
        w("\t\t};")

    w("/* Begin XCBuildConfiguration section */")
    configuration(gid("config", "project", "Debug"), "Debug", sorted(shared + debug_only))
    configuration(gid("config", "project", "Release"), "Release", sorted(shared + release_only))
    configuration(gid("config", "target", "Debug"), "Debug", sorted(target_shared))
    configuration(gid("config", "target", "Release"), "Release", sorted(target_shared))
    w("/* End XCBuildConfiguration section */")
    w("")

    def configuration_list(list_id, label, debug_id, release_id):
        w("\t\t%s /* %s */ = {" % (list_id, label))
        w("\t\t\tisa = XCConfigurationList;")
        w("\t\t\tbuildConfigurations = (")
        w("\t\t\t\t%s /* Debug */," % debug_id)
        w("\t\t\t\t%s /* Release */," % release_id)
        w("\t\t\t);")
        w("\t\t\tdefaultConfigurationIsVisible = 0;")
        w("\t\t\tdefaultConfigurationName = Release;")
        w("\t\t};")

    w("/* Begin XCConfigurationList section */")
    configuration_list(project_config_list, "Build configuration list for PBXProject \"Veritas\"",
                       gid("config", "project", "Debug"), gid("config", "project", "Release"))
    configuration_list(target_config_list, "Build configuration list for PBXNativeTarget \"Veritas\"",
                       gid("config", "target", "Debug"), gid("config", "target", "Release"))
    w("/* End XCConfigurationList section */")
    w("\t};")
    w("\trootObject = %s /* Project object */;" % project_id)
    w("}")

    os.makedirs(os.path.dirname(PROJECT), exist_ok=True)
    with open(PROJECT, "w") as handle:
        handle.write("\n".join(out) + "\n")

    total = sum(len(root["sources"]) for root in roots)
    print("wrote %s" % os.path.relpath(PROJECT, ROOT))
    for root in roots:
        print("  %-12s %d Swift, %d resources" % (root["name"], len(root["sources"]), len(root["resources"])))
    print("  %d Swift files in the target" % total)

    write_scheme(target_id)


def write_scheme(target_id):
    """The shared scheme, whose BlueprintIdentifier must match the target.

    A stale identifier here is the difference between an app you can run
    and an Xcode window with no scheme in the toolbar, so it comes out of
    the same generator as the target id and cannot drift.
    """
    path = os.path.join(ROOT, "Veritas.xcodeproj", "xcshareddata", "xcschemes", "Veritas.xcscheme")

    def reference(indent):
        pad = " " * indent
        return (
            "%s<BuildableReference\n"
            "%s   BuildableIdentifier = \"primary\"\n"
            "%s   BlueprintIdentifier = \"%s\"\n"
            "%s   BuildableName = \"Veritas.app\"\n"
            "%s   BlueprintName = \"Veritas\"\n"
            "%s   ReferencedContainer = \"container:Veritas.xcodeproj\">\n"
            "%s</BuildableReference>\n" % (pad, pad, pad, target_id, pad, pad, pad, pad)
        )

    scheme = """<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1500"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
%s         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
%s      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
%s      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
""" % (reference(12), reference(9), reference(9))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as handle:
        handle.write(scheme)
    print("wrote %s (target %s)" % (os.path.relpath(path, ROOT), target_id))


if __name__ == "__main__":
    main()
